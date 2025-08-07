/**
 * Storage Interface for Propagation Networks
 * 
 * Provides pluggable storage backends for persisting network state
 */

import type { GroupState, NetworkState } from '../types'

export interface SnapshotInfo {
  id: string
  networkId: string
  label?: string
  createdAt: Date
  size?: number
}

export interface QueryFilter {
  attributes?: Record<string, any>
  author?: string
  tags?: string[]
  type?: string
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
 * Core storage interface for propagation networks
 */
export interface NetworkStorage {
  // Contact Operations
  saveContactContent(networkId: string, groupId: string, contactId: string, content: any): Promise<void>
  loadContactContent(networkId: string, groupId: string, contactId: string): Promise<any>
  
  // Group Operations  
  saveGroupState(networkId: string, groupId: string, state: GroupState): Promise<void>
  loadGroupState(networkId: string, groupId: string): Promise<GroupState | null>
  deleteGroup(networkId: string, groupId: string): Promise<void>
  
  // Network Operations
  saveNetworkState(networkId: string, state: NetworkState): Promise<void>
  loadNetworkState(networkId: string): Promise<NetworkState | null>
  listNetworks(): Promise<string[]>
  deleteNetwork(networkId: string): Promise<void>
  exists(networkId: string): Promise<boolean>
  
  // Query Operations
  queryGroups(networkId: string, filter: QueryFilter): Promise<GroupState[]>
  
  // Versioning & Snapshots
  saveSnapshot(networkId: string, label?: string): Promise<string>
  loadSnapshot(networkId: string, snapshotId: string): Promise<NetworkState>
  listSnapshots(networkId: string): Promise<SnapshotInfo[]>
  deleteSnapshot(networkId: string, snapshotId: string): Promise<void>
  
  // Federation/Replication (optional)
  subscribe?(path: string, callback: (state: GroupState) => void): () => void
  sync?(remote: NetworkStorage): Promise<void>
  
  // Lifecycle
  initialize?(): Promise<void>
  close?(): Promise<void>
}

/**
 * Factory function type for creating storage instances
 */
export type StorageFactory = (config: StorageConfig) => NetworkStorage

/**
 * Registry of available storage backends
 */
export const storageFactories = new Map<string, StorageFactory>()