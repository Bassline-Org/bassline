/**
 * CompoundDriver - A driver that delegates to multiple sub-drivers
 * 
 * This driver acts as a single driver to the kernel but internally
 * manages multiple sub-drivers for different concerns (storage, history, caching, etc.)
 * Each sub-driver is independent and the compound driver decides how to route operations.
 * 
 * The driver is generic over the command types it can handle, allowing
 * type-safe extension with custom commands.
 */

import type {
  ContactChange,
  DriverResponse,
  DriverCommand as BaseDriverCommand,
  CommandResponse,
} from '../types'
import { CommandError } from '../types'
import type { Driver, StorageDriver, DriverStats } from '../driver'
import type { GroupState } from '../../types'

// Extended command types that compound driver can handle
export interface UndoCommand {
  readonly type: 'undo'
}

export interface RedoCommand {
  readonly type: 'redo'
}

export interface ClearCacheCommand {
  readonly type: 'clear-cache'
}

export interface GetHistoryCommand {
  readonly type: 'get-history'
}

export interface ClearHistoryCommand {
  readonly type: 'clear-history'
}

// Union of all commands this compound driver can handle
export type CompoundDriverCommand = 
  | BaseDriverCommand
  | UndoCommand
  | RedoCommand
  | ClearCacheCommand
  | GetHistoryCommand
  | ClearHistoryCommand

// Extended driver interface that accepts our custom commands
export interface ExtendedDriver<TCommand = CompoundDriverCommand> extends Omit<Driver, 'handleCommand'> {
  handleCommand(command: TCommand): Promise<CommandResponse>
}

// We implement ExtendedDriver for our custom commands
// and cast to Driver when needed for kernel registration
export class CompoundDriver<TCommand extends CompoundDriverCommand = CompoundDriverCommand> 
  implements ExtendedDriver<TCommand> {
  readonly id: string
  readonly name = 'compound-driver'
  readonly version = '1.0.0'
  
  // Sub-drivers for different concerns
  private storageDriver?: StorageDriver
  private historyDriver?: ExtendedDriver<TCommand>
  private cacheDriver?: ExtendedDriver<TCommand>
  private monitorDriver?: ExtendedDriver<TCommand>
  
  constructor(id?: string) {
    this.id = id || `compound-${Date.now()}`
  }
  
  // ============================================================================
  // Sub-driver Management
  // ============================================================================
  
  setStorageDriver(driver: StorageDriver): void {
    this.storageDriver = driver
  }
  
  setHistoryDriver(driver: ExtendedDriver<TCommand>): void {
    this.historyDriver = driver
  }
  
  setCacheDriver(driver: ExtendedDriver<TCommand>): void {
    this.cacheDriver = driver
  }
  
  setMonitorDriver(driver: ExtendedDriver<TCommand>): void {
    this.monitorDriver = driver
  }
  
  // ============================================================================
  // Driver Interface Implementation
  // ============================================================================
  
  async handleChange(change: ContactChange): Promise<DriverResponse> {
    console.log('[CompoundDriver] Handling change:', {
      contactId: change.contactId,
      value: change.value,
      hasHistoryDriver: !!this.historyDriver
    })
    
    // Monitor first (if present) - for logging/metrics
    if (this.monitorDriver) {
      try {
        await this.monitorDriver.handleChange(change)
      } catch (error) {
        // Monitoring failures shouldn't stop the operation
        console.warn('Monitor driver error:', error)
      }
    }
    
    // Store previous value for history if needed
    // NOTE: This is now handled in kernel-worker.ts before the change is made
    // to ensure we capture the actual previous value
    // Keeping this code but disabled as it may be needed for other driver configurations
    /*
    if (this.historyDriver && 'storePreviousValue' in this.historyDriver) {
      try {
        // Try to get current value from storage or cache
        let currentValue = undefined
        
        if (this.cacheDriver && 'getContact' in this.cacheDriver) {
          // Try cache first
          currentValue = await (this.cacheDriver as any).getContact(change.contactId)
        } else if (this.storageDriver && 'loadGroup' in this.storageDriver) {
          // Try storage
          const groupState = await this.storageDriver.loadGroup(change.groupId)
          if (groupState?.contacts) {
            const contact = groupState.contacts.get(change.contactId)
            currentValue = contact?.content
          }
        }
        
        // Store the previous value
        (this.historyDriver as any).storePreviousValue(change.contactId, currentValue)
      } catch (error) {
        // Don't fail if we can't get previous value
        console.warn('Could not store previous value for history:', error)
      }
    }
    */
    
    // Record in history (if present) - for undo/redo
    if (this.historyDriver) {
      try {
        await this.historyDriver.handleChange(change)
      } catch (error) {
        // History failures shouldn't stop the operation
        console.warn('History driver error:', error)
      }
    }
    
    // Update cache (if present) - for performance
    if (this.cacheDriver) {
      try {
        await this.cacheDriver.handleChange(change)
      } catch (error) {
        // Cache failures shouldn't stop the operation
        console.warn('Cache driver error:', error)
      }
    }
    
    // Store persistently (if present) - this one matters
    if (this.storageDriver) {
      return await this.storageDriver.handleChange(change)
    }
    
    // If no storage driver, just succeed
    return { status: 'success' }
  }
  
  async handleCommand(command: TCommand): Promise<CommandResponse> {
    // Route commands based on type
    switch (command.type) {
      case 'undo':
      case 'redo':
      case 'get-history':
      case 'clear-history':
        // History-specific commands
        if (this.historyDriver) {
          return await this.historyDriver.handleCommand(command)
        }
        throw new CommandError('History driver not configured', { canContinue: true })
        
      case 'clear-cache':
        // Cache-specific commands
        if (this.cacheDriver) {
          return await this.cacheDriver.handleCommand(command)
        }
        throw new CommandError('Cache driver not configured', { canContinue: true })
        
      case 'initialize':
        // Initialize all sub-drivers
        const initPromises: Promise<CommandResponse>[] = []
        
        if (this.storageDriver) {
          initPromises.push(this.storageDriver.handleCommand(command))
        }
        if (this.historyDriver) {
          initPromises.push(this.historyDriver.handleCommand(command))
        }
        if (this.cacheDriver) {
          initPromises.push(this.cacheDriver.handleCommand(command))
        }
        if (this.monitorDriver) {
          initPromises.push(this.monitorDriver.handleCommand(command))
        }
        
        const results = await Promise.allSettled(initPromises)
        
        // Check if any initialization failed critically
        for (const result of results) {
          if (result.status === 'rejected') {
            // Re-throw the error
            throw result.reason
          }
        }
        
        return { status: 'success' }
        
      case 'shutdown':
        // Shutdown all sub-drivers in reverse order
        const shutdownPromises: Promise<CommandResponse>[] = []
        
        if (this.monitorDriver) {
          shutdownPromises.push(this.monitorDriver.handleCommand(command))
        }
        if (this.cacheDriver) {
          shutdownPromises.push(this.cacheDriver.handleCommand(command))
        }
        if (this.historyDriver) {
          shutdownPromises.push(this.historyDriver.handleCommand(command))
        }
        if (this.storageDriver) {
          shutdownPromises.push(this.storageDriver.handleCommand(command))
        }
        
        await Promise.allSettled(shutdownPromises)
        return { status: 'success' }
        
      case 'health-check':
        // Check health of all sub-drivers
        const isHealthy = await this.isHealthy()
        if (!isHealthy) {
          throw new CommandError('One or more sub-drivers are unhealthy', { canContinue: true })
        }
        return { 
          status: 'success',
          data: { healthy: isHealthy }
        }
        
      default:
        // Pass through to storage driver by default if it's a base command
        if (this.storageDriver && this.isBaseCommand(command)) {
          return await this.storageDriver.handleCommand(command as any)
        }
        return { status: 'success' }
    }
  }
  
  private isBaseCommand(command: TCommand): boolean {
    return command.type === 'initialize' || 
           command.type === 'shutdown' || 
           command.type === 'health-check'
  }
  
  async isHealthy(): Promise<boolean> {
    const healthChecks: Promise<boolean>[] = []
    
    if (this.storageDriver) {
      healthChecks.push(this.storageDriver.isHealthy())
    }
    if (this.historyDriver) {
      healthChecks.push(this.historyDriver.isHealthy())
    }
    if (this.cacheDriver) {
      healthChecks.push(this.cacheDriver.isHealthy())
    }
    if (this.monitorDriver) {
      healthChecks.push(this.monitorDriver.isHealthy())
    }
    
    if (healthChecks.length === 0) {
      // No sub-drivers configured, consider healthy
      return true
    }
    
    const results = await Promise.allSettled(healthChecks)
    
    // All must be healthy
    return results.every(result => 
      result.status === 'fulfilled' && result.value === true
    )
  }
  
  async getStats(): Promise<DriverStats | undefined> {
    // Collect stats from each sub-driver
    let totalProcessed = 0
    let totalFailed = 0
    let totalPending = 0
    
    if (this.storageDriver?.getStats) {
      const storageStats = await this.storageDriver.getStats()
      if (storageStats) {
        totalProcessed += storageStats.processed
        totalFailed += storageStats.failed
        totalPending += storageStats.pending
      }
    }
    
    // Aggregate stats from all sub-drivers
    const stats: DriverStats = {
      processed: totalProcessed,
      failed: totalFailed,
      pending: totalPending,
      uptime: 0,
      custom: {
        subDrivers: {
          storage: !!this.storageDriver,
          history: !!this.historyDriver,
          cache: !!this.cacheDriver,
          monitor: !!this.monitorDriver
        }
      }
    }
    
    return stats
  }
  
  // ============================================================================
  // StorageDriver Interface Implementation (if storage is configured)
  // ============================================================================
  
  // Returns this driver as a standard Driver for kernel registration
  asDriver(): Driver {
    return this as any
  }
  
  // Returns this driver as a StorageDriver if storage is configured
  asStorageDriver(): StorageDriver | undefined {
    if (!this.storageDriver) return undefined
    return this as any
  }
  
  async loadGroup(groupId: string): Promise<GroupState | undefined> {
    // Try cache first if available
    if (this.cacheDriver && 'loadGroup' in this.cacheDriver) {
      const cached = await (this.cacheDriver as any).loadGroup(groupId)
      if (cached) return cached
    }
    
    // Fall back to storage
    if (this.storageDriver) {
      return await this.storageDriver.loadGroup(groupId)
    }
    
    return undefined
  }
  
  async beginBatch?(): Promise<void> {
    if (this.storageDriver?.beginBatch) {
      await this.storageDriver.beginBatch()
    }
  }
  
  async commitBatch?(): Promise<void> {
    if (this.storageDriver?.commitBatch) {
      await this.storageDriver.commitBatch()
    }
  }
  
  async rollbackBatch?(): Promise<void> {
    if (this.storageDriver?.rollbackBatch) {
      await this.storageDriver.rollbackBatch()
    }
  }
  
  getCapabilities() {
    if (this.storageDriver) {
      return this.storageDriver.getCapabilities()
    }
    
    // Default capabilities if no storage driver
    return {
      supportsBatching: false,
      supportsTransactions: false,
      supportsStreaming: false,
      persistent: false
    }
  }
}