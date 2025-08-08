/**
 * Driver interface definitions
 * Drivers are kernel-space gadgets that handle side effects
 */

import type {
  ContactChange,
  DriverResponse,
  DriverCommand,
  CommandResponse,
  ExternalInput,
} from './types'
import type { GroupState } from '../types'

/**
 * Base driver interface
 * All drivers must implement this contract
 * 
 * Drivers MUST:
 * - Throw DriverError on failures (no silent failures!)
 * - Handle their own backpressure/queuing internally
 * - Be stateless or manage their own state safely
 * - Clean up resources on shutdown
 */
export interface Driver {
  /**
   * Unique identifier for this driver instance
   */
  readonly id: string
  
  /**
   * Human-readable name for this driver type
   */
  readonly name: string
  
  /**
   * Driver version for compatibility checking
   */
  readonly version: string
  
  /**
   * Handle a change from userspace
   * MUST throw DriverError on failure
   * 
   * @throws {DriverError} When the driver cannot process the change
   */
  handleChange(change: ContactChange): Promise<DriverResponse>
  
  /**
   * Handle a command from the kernel
   * MUST throw CommandError on failure
   * 
   * @throws {CommandError} When the command cannot be executed
   */
  handleCommand(command: DriverCommand): Promise<CommandResponse>
  
  /**
   * Check if driver is healthy and operational
   * Returns true if healthy, throws if not
   * 
   * @throws {DriverError} When driver is unhealthy
   */
  isHealthy(): Promise<boolean>
  
  /**
   * Get driver statistics/metrics
   * Optional - drivers can return undefined if not supported
   */
  getStats?(): Promise<DriverStats | undefined>
}

/**
 * Bridge driver interface
 * Drivers that can send external input back to the kernel
 */
export interface BridgeDriver extends Driver {
  /**
   * Register a callback for sending external input to kernel
   * The kernel calls this during driver registration
   */
  setInputHandler(handler: (input: ExternalInput) => Promise<void>): void
  
  /**
   * Start listening for external input
   * Called after initialization
   */
  startListening(): Promise<void>
  
  /**
   * Stop listening for external input
   * Called before shutdown
   */
  stopListening(): Promise<void>
}

/**
 * Storage driver interface
 * Specialized driver for persistence
 */
export interface StorageDriver extends Driver {
  /**
   * Check any preconditions before processing changes
   * This is where drivers can ensure infrastructure exists,
   * validate permissions, check disk space, etc.
   * 
   * @throws {DriverError} If preconditions are not met
   */
  checkPreconditions?(change: ContactChange): Promise<void>
  
  /**
   * Check any postconditions after processing changes
   * This is where drivers can verify data integrity,
   * update indexes, trigger side effects, etc.
   * 
   * @throws {DriverError} If postconditions are not met
   */
  checkPostconditions?(change: ContactChange): Promise<void>
  
  /**
   * Load existing state for a group
   * Returns undefined if group doesn't exist
   */
  loadGroup(groupId: string): Promise<GroupState | undefined>
  
  /**
   * Optional: Batch operations for efficiency
   * Only implement if the storage backend supports transactions
   */
  beginBatch?(): Promise<void>
  commitBatch?(): Promise<void>
  rollbackBatch?(): Promise<void>
  
  /**
   * Get storage capabilities
   * Allows kernel to query what this driver supports
   */
  getCapabilities(): StorageCapabilities
}

/**
 * Storage driver capabilities
 */
export interface StorageCapabilities {
  readonly supportsBatching: boolean
  readonly supportsTransactions: boolean
  readonly supportsStreaming: boolean
  readonly maxBatchSize?: number
  readonly persistent: boolean  // false for in-memory storage
}

/**
 * Driver statistics for monitoring
 */
export interface DriverStats {
  readonly processed: number
  readonly failed: number
  readonly pending: number
  readonly lastError?: string
  readonly uptime: number
  readonly custom?: Record<string, unknown>
}