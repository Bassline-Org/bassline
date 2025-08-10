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
import type { DriverStats } from '../driver'
import type { 
  CompoundDriverCommand, 
  ExtendedDriver 
} from './compound-driver'

interface HistoryEntry {
  description: string
  operations: ExternalInput[]  // Operations that were performed
  timestamp: number
}

export interface HistoryDriverConfig {
  maxHistorySize?: number  // Maximum number of entries to keep
}

export class HistoryDriver implements ExtendedDriver<CompoundDriverCommand> {
  readonly id: string
  readonly name = 'history-driver'
  readonly version = '1.0.0'
  
  private history: HistoryEntry[] = []
  private currentIndex = -1
  private config: Required<HistoryDriverConfig>
  private inputHandler?: (input: ExternalInput) => Promise<void>
  private isApplyingHistory = false  // Flag to prevent recording undo/redo operations
  
  // Recording state
  private isRecording = false
  private currentRecording: {
    description: string
    operations: ExternalInput[]
  } | null = null
  
  // Statistics
  private stats = {
    totalOperations: 0,
    undoCount: 0,
    redoCount: 0
  }
  
  constructor(id?: string, config?: HistoryDriverConfig) {
    this.id = id || `history-${Date.now()}`
    this.config = {
      maxHistorySize: config?.maxHistorySize ?? 100
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
   * Start recording a series of operations as a single undoable action
   * 
   * Note: Recording after an undo does NOT truncate future history.
   * This allows for non-destructive history management where you can
   * still access "undone" operations if needed, similar to Smalltalk's
   * approach and aligned with monotonic cell philosophy.
   */
  async record<T>(description: string, callback: () => Promise<T>): Promise<T> {
    if (this.isRecording) {
      // Nested recording - just execute the callback without recording
      return await callback()
    }
    
    // Start recording
    this.isRecording = true
    this.currentRecording = {
      description,
      operations: []
    }
    
    try {
      // Execute the callback
      const result = await callback()
      
      // If operations were recorded, add to history
      if (this.currentRecording.operations.length > 0) {
        // Insert at current position without truncating
        // This preserves future history for non-destructive undo/redo
        const entry: HistoryEntry = {
          description,
          operations: this.currentRecording.operations,
          timestamp: Date.now()
        }
        
        // Insert after currentIndex
        this.history.splice(this.currentIndex + 1, 0, entry)
        this.currentIndex++
        
        // Enforce max history size from the beginning
        if (this.history.length > this.config.maxHistorySize) {
          const removeCount = this.history.length - this.config.maxHistorySize
          this.history = this.history.slice(removeCount)
          this.currentIndex = Math.max(0, this.currentIndex - removeCount)
        }
        
        this.stats.totalOperations++
        
        console.log('[HistoryDriver] Recorded action:', {
          description,
          operationCount: this.currentRecording.operations.length,
          historyLength: this.history.length,
          currentIndex: this.currentIndex
        })
      }
      
      return result
    } finally {
      this.isRecording = false
      this.currentRecording = null
    }
  }
  
  /**
   * Track an operation that was performed (called by the system during recording)
   */
  trackOperation(input: ExternalInput): void {
    if (this.isRecording && this.currentRecording && !this.isApplyingHistory) {
      this.currentRecording.operations.push(input)
      console.log('[HistoryDriver] Tracked operation:', input.type)
    }
  }
  
  /**
   * Compute the inverse of an operation
   * Note: This requires that operations store enough info to be reversible
   * Returns an array of operations for complex inverses (e.g., group removal with wires)
   */
  private computeInverses(input: ExternalInput): ExternalInput[] {
    const inverses: ExternalInput[] = []
    
    switch (input.type) {
      case 'external-contact-update':
        // For contact updates, we need the previous value
        // This should be stored in the input's metadata
        inverses.push({
          type: 'external-contact-update',
          source: 'history-driver',
          contactId: input.contactId,
          groupId: input.groupId,
          value: (input as any).previousValue ?? null
        })
        break
      
      case 'external-add-contact':
        // Inverse of add is remove
        inverses.push({
          type: 'external-remove-contact',
          source: 'history-driver',
          contactId: (input as any).resultId || (input as any).contactId
        })
        break
      
      case 'external-remove-contact':
        // Inverse of remove is add (needs the original data)
        inverses.push({
          type: 'external-add-contact',
          source: 'history-driver',
          groupId: (input as any).groupId,
          contact: (input as any).contact
        })
        break
      
      case 'external-add-group':
        // Inverse of add group is remove
        inverses.push({
          type: 'external-remove-group',
          source: 'history-driver',
          groupId: (input as any).resultId || (input as any).groupId
        })
        break
      
      case 'external-remove-group':
        // Inverse of remove group is add, plus recreate any connected wires
        inverses.push({
          type: 'external-add-group',
          source: 'history-driver',
          parentGroupId: (input as any).parentGroupId,
          group: (input as any).group
        })
        
        // Also recreate any wires that were connected to the group
        const connectedWires = (input as any).connectedWires
        if (connectedWires && Array.isArray(connectedWires)) {
          for (const wire of connectedWires) {
            inverses.push({
              type: 'external-create-wire',
              source: 'history-driver',
              fromContactId: wire.fromId,
              toContactId: wire.toId
            })
          }
        }
        break
      
      case 'external-create-wire':
        // Inverse of create wire is remove
        inverses.push({
          type: 'external-remove-wire',
          source: 'history-driver',
          wireId: (input as any).resultId || (input as any).wireId
        })
        break
      
      case 'external-remove-wire':
        // Inverse of remove wire is create
        inverses.push({
          type: 'external-create-wire',
          source: 'history-driver',
          fromContactId: (input as any).fromContactId,
          toContactId: (input as any).toContactId
        })
        break
      
      case 'external-create-primitive-gadget':
        // Inverse of create primitive gadget is remove group
        // (primitive gadgets are just groups with special behavior)
        inverses.push({
          type: 'external-remove-group',
          source: 'history-driver',
          groupId: (input as any).resultId || (input as any).groupId
        })
        break
      
      default:
        console.warn('[HistoryDriver] Cannot compute inverse for operation:', input.type)
    }
    
    return inverses
  }
  
  async handleChange(change: ContactChange): Promise<DriverResponse> {
    // We don't record individual changes anymore
    // Operations are tracked via trackOperation() during record()
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
        return { status: 'success' }
        
      case 'initialize':
        // Nothing to initialize
        return { status: 'success' }
        
      case 'shutdown':
        // Clear history on shutdown
        this.history = []
        this.currentIndex = -1
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
      console.log('[HistoryDriver] Undoing:', entry.description)
      
      // Set flag to prevent recording
      this.isApplyingHistory = true
      
      // Apply inverse operations in reverse order
      // Each operation can produce multiple inverse operations
      const allInverseOps: ExternalInput[] = []
      for (const op of entry.operations.reverse()) {
        const inverses = this.computeInverses(op)
        allInverseOps.push(...inverses)
      }
      
      for (const inverseOp of allInverseOps) {
        await this.inputHandler(inverseOp)
      }
      
      // Move the index back
      this.currentIndex--
      this.stats.undoCount++
      
      // Reset flag immediately
      this.isApplyingHistory = false
      
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
      console.log('[HistoryDriver] Redoing:', entry.description)
      
      // Set flag to prevent recording
      this.isApplyingHistory = true
      
      // Re-apply the original operations
      for (const op of entry.operations) {
        await this.inputHandler(op)
      }
      
      this.stats.redoCount++
      
      // Reset flag immediately
      this.isApplyingHistory = false
      
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