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

export interface StorageError {
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
 * Core storage interface for propagation networks with strong domain typing
 */
export interface NetworkStorage {
  // Contact Operations
  saveContactContent<T = unknown>(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId, 
    content: Serializable<T>
  ): Promise<Result<void, StorageError>>
  
  loadContactContent<T = unknown>(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId
  ): Promise<Result<T | null, StorageError>>
  
  // Group Operations  
  saveGroupState(
    networkId: NetworkId, 
    groupId: GroupId, 
    state: GroupState
  ): Promise<Result<void, StorageError>>
  
  loadGroupState(
    networkId: NetworkId, 
    groupId: GroupId
  ): Promise<Result<GroupState | null, StorageError>>
  
  deleteGroup(
    networkId: NetworkId, 
    groupId: GroupId
  ): Promise<Result<void, StorageError>>
  
  // Network Operations
  saveNetworkState(
    networkId: NetworkId, 
    state: NetworkState
  ): Promise<Result<void, StorageError>>
  
  loadNetworkState(
    networkId: NetworkId
  ): Promise<Result<NetworkState | null, StorageError>>
  
  listNetworks(): Promise<Result<NetworkId[], StorageError>>
  
  deleteNetwork(
    networkId: NetworkId
  ): Promise<Result<void, StorageError>>
  
  exists(
    networkId: NetworkId
  ): Promise<Result<boolean, StorageError>>
  
  // Query Operations
  queryGroups(
    networkId: NetworkId, 
    filter: QueryFilter
  ): Promise<Result<GroupState[], StorageError>>
  
  // Versioning & Snapshots
  saveSnapshot(
    networkId: NetworkId, 
    label?: string
  ): Promise<Result<SnapshotId, StorageError>>
  
  loadSnapshot(
    networkId: NetworkId, 
    snapshotId: SnapshotId
  ): Promise<Result<NetworkState, StorageError>>
  
  listSnapshots(
    networkId: NetworkId
  ): Promise<Result<SnapshotInfo[], StorageError>>
  
  deleteSnapshot(
    networkId: NetworkId, 
    snapshotId: SnapshotId
  ): Promise<Result<void, StorageError>>
  
  // Federation/Replication (optional)
  subscribe?(
    path: string, 
    callback: (state: GroupState) => void
  ): Result<() => void, StorageError>
  
  sync?(
    remote: NetworkStorage
  ): Promise<Result<void, StorageError>>
  
  // Lifecycle
  initialize?(): Promise<Result<void, StorageError>>
  close?(): Promise<Result<void, StorageError>>
}

/**
 * Factory function type for creating storage instances
 */
export type StorageFactory = (config: StorageConfig) => NetworkStorage

/**
 * Registry of available storage backends
 */
export const storageFactories = new Map<string, StorageFactory>()