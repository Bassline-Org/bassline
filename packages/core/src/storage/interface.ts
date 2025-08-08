/**
 * Storage Interface for Propagation Networks
 * 
 * Provides pluggable storage backends for persisting network state
 */

import type { 
  GroupState, 
  NetworkState, 
  Result,
  NetworkId,
  GroupId,
  ContactId,
  SnapshotId,
  Serializable
} from '../types'

// ============================================================================
// Storage Domain Types
// ============================================================================

export type StorageErrorCode = 
  | 'NETWORK_NOT_FOUND'
  | 'GROUP_NOT_FOUND'
  | 'CONTACT_NOT_FOUND'
  | 'SNAPSHOT_NOT_FOUND'
  | 'STORAGE_CONNECTION_ERROR'
  | 'STORAGE_PERMISSION_ERROR'
  | 'STORAGE_SERIALIZATION_ERROR'
  | 'STORAGE_CORRUPTION_ERROR'

export interface IStorageError {
  code: StorageErrorCode
  message: string
  details?: unknown
}

export interface SnapshotInfo {
  id: SnapshotId
  networkId: NetworkId
  label?: string
  createdAt: Date
  size?: number
}

// Extensible query system with type safety
export interface QueryFilter<T extends Record<string, unknown> = Record<string, unknown>> {
  attributes?: Partial<T>
  author?: string
  tags?: string[]
  type?: string
}

// Storage operation context for extensibility
export interface StorageOperationContext {
  readonly timestamp: Date
  readonly userId?: string
  readonly metadata?: Record<string, Serializable<unknown>>
}

export interface StorageConfig {
  type: 'memory' | 'postgres' | 'filesystem' | 'remote'
  options?: {
    // PostgreSQL options
    connectionString?: string
    poolSize?: number
    
    // FileSystem options
    basePath?: string
    compression?: boolean
    
    // Remote options
    serverUrl?: string
    authToken?: string
  }
  
  // Common options
  cache?: {
    enabled: boolean
    ttl?: number
    maxSize?: number
  }
  
  // Persistence behavior
  persistence?: {
    autoSave: boolean
    saveInterval?: number
    snapshotInterval?: number
  }
}

/**
 * NetworkStorage Abstract Base Class
 * 
 * Provides a rich domain API for propagation network storage operations
 * while implementing the StorageDriver interface for kernel integration.
 * 
 * Storage drivers should extend this class and implement the abstract methods.
 */

import type {
  StorageDriver,
  StorageCapabilities,
} from '../kernel/driver'
import type {
  ContactChange,
  DriverResponse,
  DriverCommand,
  CommandResponse,
} from '../kernel/types'
import { DriverError, CommandError } from '../kernel/types'

/**
 * Abstract base class for network storage implementations
 * Handles StorageDriver interface and provides rich domain methods
 */
export abstract class NetworkStorage implements StorageDriver {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly version: string

  // ============================================================================
  // StorageDriver Interface Implementation
  // ============================================================================

  async handleChange(change: ContactChange): Promise<DriverResponse> {
    try {
      // Route to domain method using default network
      await this.saveContactContent(
        this.getDefaultNetworkId(),
        change.groupId,
        change.contactId,
        change.value
      )

      return { status: 'success', metadata: { driverId: this.id } }
    } catch (error: any) {
      throw new DriverError(
        `Failed to handle contact change for ${change.contactId}: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }

  async handleCommand(command: DriverCommand): Promise<CommandResponse> {
    try {
      switch (command.type) {
        case 'initialize':
          await this.initialize()
          return { status: 'success' }

        case 'shutdown':
          await this.close()
          return { status: 'success' }

        case 'health-check':
          const healthy = await this.isHealthy()
          return { 
            status: 'success', 
            data: { healthy, driverId: this.id } 
          }

        default:
          throw new CommandError(
            `Unknown command type: ${(command as any).type}`,
            { canContinue: true }
          )
      }
    } catch (error: any) {
      if (error instanceof CommandError) {
        throw error
      }
      throw new CommandError(
        `Failed to handle command ${command.type}: ${error.message}`,
        { canContinue: false, originalError: error }
      )
    }
  }

  async loadGroup(groupId: string): Promise<GroupState | undefined> {
    // Use default network for this simplified interface
    const result = await this.loadGroupState(
      this.getDefaultNetworkId(),
      groupId as GroupId
    )
    return result || undefined
  }

  // ============================================================================
  // Abstract Domain Methods - Implement in subclasses
  // ============================================================================

  /**
   * Initialize the storage backend
   * Called during driver startup
   */
  abstract initialize(): Promise<void>

  /**
   * Close the storage backend and clean up resources
   * Called during driver shutdown
   */
  abstract close(): Promise<void>

  /**
   * Check if storage is healthy and operational
   */
  abstract isHealthy(): Promise<boolean>

  /**
   * Get storage capabilities
   */
  abstract getCapabilities(): StorageCapabilities

  /**
   * Get the default network ID for simplified operations
   */
  abstract getDefaultNetworkId(): NetworkId

  // ============================================================================
  // Contact Operations
  // ============================================================================

  /**
   * Save contact content to storage
   * @throws {DriverError} If save operation fails
   */
  abstract saveContactContent<T = unknown>(
    networkId: NetworkId,
    groupId: GroupId,
    contactId: ContactId,
    content: Serializable<T>
  ): Promise<void>

  /**
   * Load contact content from storage
   * @returns Content or null if not found
   * @throws {DriverError} If load operation fails
   */
  abstract loadContactContent<T = unknown>(
    networkId: NetworkId,
    groupId: GroupId,
    contactId: ContactId
  ): Promise<T | null>

  // ============================================================================
  // Group Operations
  // ============================================================================

  /**
   * Save complete group state to storage
   * @throws {DriverError} If save operation fails
   */
  abstract saveGroupState(
    networkId: NetworkId,
    groupId: GroupId,
    state: GroupState
  ): Promise<void>

  /**
   * Load complete group state from storage
   * @returns Group state or null if not found
   * @throws {DriverError} If load operation fails
   */
  abstract loadGroupState(
    networkId: NetworkId,
    groupId: GroupId
  ): Promise<GroupState | null>

  /**
   * Delete a group and all its data
   * @throws {DriverError} If delete operation fails
   */
  abstract deleteGroup(
    networkId: NetworkId,
    groupId: GroupId
  ): Promise<void>

  // ============================================================================
  // Network Operations
  // ============================================================================

  /**
   * Save complete network state to storage
   * @throws {DriverError} If save operation fails
   */
  abstract saveNetworkState(
    networkId: NetworkId,
    state: NetworkState
  ): Promise<void>

  /**
   * Load complete network state from storage
   * @returns Network state or null if not found
   * @throws {DriverError} If load operation fails
   */
  abstract loadNetworkState(
    networkId: NetworkId
  ): Promise<NetworkState | null>

  /**
   * Delete a network and all its data
   * @throws {DriverError} If delete operation fails
   */
  abstract deleteNetwork(networkId: NetworkId): Promise<void>

  /**
   * Check if a network exists
   * @returns True if network exists
   * @throws {DriverError} If check operation fails
   */
  abstract exists(networkId: NetworkId): Promise<boolean>

  /**
   * List all available networks
   * @returns Array of network IDs
   * @throws {DriverError} If list operation fails
   */
  abstract listNetworks(): Promise<NetworkId[]>

  // ============================================================================
  // Query Operations
  // ============================================================================

  /**
   * Query groups by filter (optional)
   * @throws {DriverError} If query operation fails
   */
  abstract queryGroups?(
    networkId: NetworkId,
    filter: QueryFilter
  ): Promise<GroupState[]>

  // ============================================================================
  // Snapshot Operations (Optional)
  // ============================================================================

  /**
   * Create a snapshot of the current network state
   * @param label Optional label for the snapshot
   * @returns Snapshot ID
   * @throws {DriverError} If snapshot creation fails
   */
  abstract saveSnapshot?(
    networkId: NetworkId,
    label?: string
  ): Promise<SnapshotId>

  /**
   * Load a network state from a snapshot
   * @throws {DriverError} If snapshot load fails
   */
  abstract loadSnapshot?(
    networkId: NetworkId,
    snapshotId: SnapshotId
  ): Promise<NetworkState>

  /**
   * List available snapshots for a network
   * @throws {DriverError} If list operation fails
   */
  abstract listSnapshots?(
    networkId: NetworkId
  ): Promise<Array<{ id: SnapshotId; label?: string; createdAt: Date }>>

  /**
   * Delete a snapshot
   * @throws {DriverError} If delete operation fails
   */
  abstract deleteSnapshot?(
    networkId: NetworkId,
    snapshotId: SnapshotId
  ): Promise<void>

  /**
   * Optional: Sync with another storage backend
   * @throws {DriverError} If sync operation fails
   */
  abstract sync?(remote: NetworkStorage): Promise<void>
}

/**
 * Factory function type for creating storage instances
 */
export type StorageFactory = (config: StorageConfig) => NetworkStorage

/**
 * Registry of available storage backends
 */
export const storageFactories = new Map<string, StorageFactory>()