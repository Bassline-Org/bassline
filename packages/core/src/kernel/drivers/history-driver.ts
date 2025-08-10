/**
 * HistoryDriver - Tracks changes for undo/redo functionality
 * 
 * This driver records all changes that pass through it and maintains
 * a history stack that can be used for undo/redo operations.
 * It needs a reference to the kernel to apply inverse operations.
 */

import type {
  ContactChange,
  DriverResponse,
  CommandResponse,
  ExternalInput,
} from '../types'
import { CommandError } from '../types'
import { brand } from '../../types'
import type { Driver, DriverStats } from '../driver'
import type { 
  CompoundDriverCommand, 
  ExtendedDriver 
} from './compound-driver'

interface HistoryEntry {
  change: ContactChange
  timestamp: number
  description?: string
  // Store the previous value for creating accurate inverse
  previousValue?: unknown
}

export interface HistoryDriverConfig {
  maxHistorySize?: number  // Maximum number of entries to keep
  captureInterval?: number // Minimum ms between captures (for coalescing)
}

export class HistoryDriver implements ExtendedDriver<CompoundDriverCommand> {
  readonly id: string
  readonly name = 'history-driver'
  readonly version = '1.0.0'
  
  private history: HistoryEntry[] = []
  private currentIndex = -1
  private config: Required<HistoryDriverConfig>
  private lastCaptureTime = 0
  private previousValues = new Map<string, unknown>()
  private inputHandler?: (input: ExternalInput) => Promise<void>
  private isApplyingHistory = false  // Flag to prevent recording undo/redo operations
  
  // Statistics
  private stats = {
    totalOperations: 0,
    undoCount: 0,
    redoCount: 0
  }
  
  constructor(id?: string, config?: HistoryDriverConfig) {
    this.id = id || `history-${Date.now()}`
    this.config = {
      maxHistorySize: config?.maxHistorySize ?? 100,
      captureInterval: config?.captureInterval ?? 100  // 100ms default for coalescing rapid edits
    }
  }
  
  
  /**
   * Set the input handler for emitting ExternalInput events
   * Similar to bridge drivers, this allows HistoryDriver to send operations to runtime
   */
  setInputHandler(handler: (input: ExternalInput) => Promise<void>): void {
    this.inputHandler = handler
  }
  
  /**
   * Store previous value before a change (for accurate undo)
   * This should be called by the compound driver before applying changes
   */
  storePreviousValue(contactId: string, value: unknown): void {
    const key = contactId
    this.previousValues.set(key, value)
  }
  
  async handleChange(change: ContactChange): Promise<DriverResponse> {
    // Skip recording if we're currently applying history (undo/redo)
    if (this.isApplyingHistory) {
      console.log('[HistoryDriver] Skipping recording during history application')
      return { status: 'success' }
    }
    
    console.log('[HistoryDriver] Recording change:', {
      contactId: change.contactId,
      value: change.value,
      historyLength: this.history.length,
      currentIndex: this.currentIndex
    })
    
    const now = Date.now()
    
    // Check if we should coalesce with the previous entry
    if (this.shouldCoalesce(change, now)) {
      // Update the last entry instead of creating a new one
      const lastEntry = this.history[this.currentIndex]
      if (lastEntry && lastEntry.change.contactId === change.contactId) {
        lastEntry.change = change
        lastEntry.timestamp = now
        return { status: 'success' }
      }
    }
    
    // Truncate history if we're not at the end (user did something after undo)
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1)
    }
    
    // Get previous value if stored
    const key = change.contactId
    const previousValue = this.previousValues.get(key) ?? null
    
    // Create history entry
    const entry: HistoryEntry = {
      change,
      timestamp: now,
      previousValue,
      description: this.describeChange(change)
    }
    
    // Add to history
    this.history.push(entry)
    this.currentIndex++
    
    // Enforce max history size
    if (this.history.length > this.config.maxHistorySize) {
      const removeCount = this.history.length - this.config.maxHistorySize
      this.history = this.history.slice(removeCount)
      this.currentIndex = Math.max(0, this.currentIndex - removeCount)
    }
    
    // Update stats
    this.stats.totalOperations++
    this.lastCaptureTime = now
    
    // Store current value as "previous" for next change
    this.previousValues.set(key, change.value)
    
    return { status: 'success' }
  }
  
  async handleCommand(command: CompoundDriverCommand): Promise<CommandResponse> {
    switch (command.type) {
      case 'undo':
        return await this.undo()
        
      case 'redo':
        return await this.redo()
        
      case 'get-history':
        // Return history info for UI display
        return {
          status: 'success',
          data: {
            history: this.history.map(e => ({
              description: e.description,
              timestamp: e.timestamp
            })),
            currentIndex: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
          }
        }
        
      case 'clear-history':
        this.history = []
        this.currentIndex = -1
        this.previousValues.clear()
        return { status: 'success' }
        
      case 'initialize':
        // Nothing to initialize
        return { status: 'success' }
        
      case 'shutdown':
        // Clear history on shutdown
        this.history = []
        this.currentIndex = -1
        this.previousValues.clear()
        return { status: 'success' }
        
      default:
        return { status: 'success' }
    }
  }
  
  private async undo(): Promise<CommandResponse> {
    if (!this.canUndo()) {
      throw new CommandError('Nothing to undo', { canContinue: true })
    }
    
    if (!this.inputHandler) {
      throw new CommandError('Input handler not set - cannot perform undo', { canContinue: false })
    }
    
    const entry = this.history[this.currentIndex]
    
    try {
      console.log('[HistoryDriver] Applying undo - emitting external update:', {
        contactId: entry.change.contactId,
        currentValue: entry.change.value,
        previousValue: entry.previousValue
      })
      
      // Set flag to prevent recording this change
      this.isApplyingHistory = true
      
      // Emit an external contact update with the previous value
      // This will flow through the runtime properly
      const input: ExternalInput = {
        type: 'external-contact-update',
        source: 'history-driver',
        contactId: entry.change.contactId,
        groupId: entry.change.groupId,
        value: entry.previousValue ?? null
      }
      
      await this.inputHandler(input)
      
      // Move the index back
      this.currentIndex--
      this.stats.undoCount++
      
      // Reset flag after a short delay to ensure the change has propagated
      setTimeout(() => {
        this.isApplyingHistory = false
      }, 10)
      
      return { 
        status: 'success',
        data: { 
          undone: entry.description,
          canUndo: this.canUndo(),
          canRedo: this.canRedo()
        }
      }
    } catch (error) {
      this.isApplyingHistory = false
      throw new CommandError(`Undo failed: ${error}`, { 
        canContinue: true,
        originalError: error as Error
      })
    }
  }
  
  private async redo(): Promise<CommandResponse> {
    if (!this.canRedo()) {
      throw new CommandError('Nothing to redo', { canContinue: true })
    }
    
    if (!this.inputHandler) {
      throw new CommandError('Input handler not set - cannot perform redo', { canContinue: false })
    }
    
    // Move index forward first
    this.currentIndex++
    const entry = this.history[this.currentIndex]
    
    try {
      console.log('[HistoryDriver] Applying redo - emitting external update:', {
        contactId: entry.change.contactId,
        value: entry.change.value
      })
      
      // Set flag to prevent recording this change
      this.isApplyingHistory = true
      
      // Emit an external contact update with the original value
      const input: ExternalInput = {
        type: 'external-contact-update',
        source: 'history-driver',
        contactId: entry.change.contactId,
        groupId: entry.change.groupId,
        value: entry.change.value
      }
      
      await this.inputHandler(input)
      
      this.stats.redoCount++
      
      // Reset flag after a short delay
      setTimeout(() => {
        this.isApplyingHistory = false
      }, 10)
      
      return { 
        status: 'success',
        data: { 
          redone: entry.description,
          canUndo: this.canUndo(),
          canRedo: this.canRedo()
        }
      }
    } catch (error) {
      // Revert index on failure
      this.currentIndex--
      this.isApplyingHistory = false
      throw new CommandError(`Redo failed: ${error}`, { 
        canContinue: true,
        originalError: error as Error
      })
    }
  }
  
  private shouldCoalesce(change: ContactChange, now: number): boolean {
    // Coalesce rapid edits to the same contact
    if (this.currentIndex < 0) return false
    
    const timeSinceLastCapture = now - this.lastCaptureTime
    if (timeSinceLastCapture > this.config.captureInterval) return false
    
    const lastEntry = this.history[this.currentIndex]
    if (!lastEntry) return false
    
    // Only coalesce if it's the same contact
    return lastEntry.change.contactId === change.contactId
  }
  
  private describeChange(change: ContactChange): string {
    // Generate a human-readable description
    if (change.value === null || change.value === undefined) {
      return `Delete contact ${change.contactId.slice(0, 8)}...`
    }
    
    if (typeof change.value === 'string') {
      const preview = change.value.length > 20 
        ? change.value.slice(0, 20) + '...' 
        : change.value
      return `Update contact to "${preview}"`
    }
    
    if (typeof change.value === 'number') {
      return `Update contact to ${change.value}`
    }
    
    if (typeof change.value === 'boolean') {
      return `Update contact to ${change.value}`
    }
    
    return `Update contact ${change.contactId.slice(0, 8)}...`
  }
  
  canUndo(): boolean {
    return this.currentIndex >= 0
  }
  
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1
  }
  
  async isHealthy(): Promise<boolean> {
    // History driver is always healthy unless it runs out of memory
    return this.history.length < this.config.maxHistorySize * 2  // Some buffer
  }
  
  async getStats?(): Promise<DriverStats> {
    return {
      processed: this.stats.totalOperations,
      failed: 0,
      pending: 0,
      uptime: Date.now(),  // Would need to track actual start time
      custom: {
        historySize: this.history.length,
        currentIndex: this.currentIndex,
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoCount: this.stats.undoCount,
        redoCount: this.stats.redoCount
      }
    }
  }
}