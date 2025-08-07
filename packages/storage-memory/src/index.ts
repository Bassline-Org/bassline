/**
 * In-memory storage implementation for Bassline
 * 
 * Provides fast, ephemeral storage with strong domain types
 * and Result-based error handling - perfect for testing and development
 */

import type { 
  NetworkStorage, 
  StorageConfig, 
  StorageError,
  SnapshotInfo, 
  QueryFilter,
  GroupState,
  NetworkState,
  Result,
  NetworkId,
  GroupId,
  ContactId,
  SnapshotId,
  Serializable
} from '@bassline/core'
import { brand } from '@bassline/core'

interface StoredNetwork {
  id: NetworkId
  groups: Map<GroupId, GroupState>
  contacts: Map<string, any> // contactId -> content
  createdAt: Date
  updatedAt: Date
}

interface Snapshot {
  id: SnapshotId
  networkId: NetworkId
  label?: string
  state: NetworkState
  createdAt: Date
}

export class MemoryStorage implements NetworkStorage {
  private networks = new Map<NetworkId, StoredNetwork>()
  private snapshots = new Map<SnapshotId, Snapshot>()
  private subscriptions = new Map<string, Set<(state: GroupState) => void>>()
  
  constructor(config?: StorageConfig) {
    // Memory storage doesn't need configuration
  }
  
  // ============================================================================
  // Helper Methods
  // ============================================================================
  
  private contactKey(groupId: GroupId, contactId: ContactId): string {
    return `${groupId}:${contactId}`
  }
  
  private ok<T>(value: T): Result<T, StorageError> {
    return { ok: true, value }
  }
  
  private error(code: StorageError['code'], message: string, details?: unknown): Result<never, StorageError> {
    return {
      ok: false,
      error: { code, message, details }
    }
  }
  
  // ============================================================================
  // NetworkStorage Implementation
  // ============================================================================
  
  // Contact Operations
  async saveContactContent<T = unknown>(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId, 
    content: Serializable<T>
  ): Promise<Result<void, StorageError>> {
    const network = this.networks.get(networkId)
    if (!network) {
      return this.error('NETWORK_NOT_FOUND', `Network ${networkId} not found`)
    }
    
    const group = network.groups.get(groupId)
    if (!group) {
      return this.error('GROUP_NOT_FOUND', `Group ${groupId} not found in network ${networkId}`)
    }
    
    const key = this.contactKey(groupId, contactId)
    network.contacts.set(key, content)
    network.updatedAt = new Date()
    
    return this.ok(undefined)
  }
  
  async loadContactContent<T = unknown>(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId
  ): Promise<Result<T | null, StorageError>> {
    const network = this.networks.get(networkId)
    if (!network) {
      return this.ok(null)
    }
    
    const key = this.contactKey(groupId, contactId)
    const content = network.contacts.get(key)
    return this.ok(content ?? null)
  }
  
  // Group Operations  
  async saveGroupState(
    networkId: NetworkId, 
    groupId: GroupId, 
    state: GroupState
  ): Promise<Result<void, StorageError>> {
    let network = this.networks.get(networkId)
    if (!network) {
      network = {
        id: networkId,
        groups: new Map(),
        contacts: new Map(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
      this.networks.set(networkId, network)
    }
    
    network.groups.set(groupId, state)
    network.updatedAt = new Date()
    
    // Notify subscribers
    const path = `${networkId}/${groupId}`
    const callbacks = this.subscriptions.get(path)
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(state)
        } catch (error) {
          console.warn('Subscription callback error:', error)
        }
      })
    }
    
    return this.ok(undefined)
  }
  
  async loadGroupState(
    networkId: NetworkId, 
    groupId: GroupId
  ): Promise<Result<GroupState | null, StorageError>> {
    const network = this.networks.get(networkId)
    if (!network) {
      return this.ok(null)
    }
    
    const state = network.groups.get(groupId)
    return this.ok(state ?? null)
  }
  
  async deleteGroup(
    networkId: NetworkId, 
    groupId: GroupId
  ): Promise<Result<void, StorageError>> {
    const network = this.networks.get(networkId)
    if (!network) {
      return this.ok(undefined) // Already doesn't exist
    }
    
    network.groups.delete(groupId)
    
    // Delete associated contacts
    const keysToDelete: string[] = []
    for (const key of network.contacts.keys()) {
      if (key.startsWith(`${groupId}:`)) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => network.contacts.delete(key))
    
    network.updatedAt = new Date()
    return this.ok(undefined)
  }
  
  // Network Operations
  async saveNetworkState(
    networkId: NetworkId, 
    state: NetworkState
  ): Promise<Result<void, StorageError>> {
    const existingNetwork = this.networks.get(networkId)
    const network: StoredNetwork = {
      id: networkId,
      groups: new Map(state.groups) as any, // Type conversion needed due to branded types
      contacts: existingNetwork?.contacts || new Map(),
      createdAt: existingNetwork?.createdAt ?? new Date(),
      updatedAt: new Date()
    }
    
    this.networks.set(networkId, network)
    return this.ok(undefined)
  }
  
  async loadNetworkState(
    networkId: NetworkId
  ): Promise<Result<NetworkState | null, StorageError>> {
    const network = this.networks.get(networkId)
    if (!network) {
      return this.ok(null)
    }
    
    const state: NetworkState = {
      groups: new Map(network.groups) as any, // Type conversion needed due to branded types
      currentGroupId: 'root',
      rootGroupId: 'root'
    }
    
    return this.ok(state)
  }
  
  async listNetworks(): Promise<Result<NetworkId[], StorageError>> {
    const networkIds = Array.from(this.networks.keys())
    return this.ok(networkIds)
  }
  
  async deleteNetwork(
    networkId: NetworkId
  ): Promise<Result<void, StorageError>> {
    this.networks.delete(networkId)
    
    // Delete associated snapshots
    const snapshotsToDelete: SnapshotId[] = []
    for (const [id, snapshot] of this.snapshots) {
      if (snapshot.networkId === networkId) {
        snapshotsToDelete.push(id)
      }
    }
    snapshotsToDelete.forEach(id => this.snapshots.delete(id))
    
    return this.ok(undefined)
  }
  
  async exists(
    networkId: NetworkId
  ): Promise<Result<boolean, StorageError>> {
    const exists = this.networks.has(networkId)
    return this.ok(exists)
  }
  
  // Query Operations
  async queryGroups(
    networkId: NetworkId, 
    filter: QueryFilter
  ): Promise<Result<GroupState[], StorageError>> {
    const network = this.networks.get(networkId)
    if (!network) {
      return this.ok([])
    }
    
    const results: GroupState[] = []
    
    for (const group of network.groups.values()) {
      let matches = true
      
      // Filter by attributes
      if (filter.attributes) {
        for (const [key, value] of Object.entries(filter.attributes)) {
          if (group.group.attributes?.[key] !== value) {
            matches = false
            break
          }
        }
      }
      
      // Filter by author
      if (filter.author && matches) {
        const author = group.group.attributes?.['bassline.author'] || 
                       group.group.attributes?.author
        if (author !== filter.author) {
          matches = false
        }
      }
      
      // Filter by tags
      if (filter.tags && matches) {
        const tags = group.group.attributes?.['bassline.tags'] || 
                    group.group.attributes?.tags || []
        const tagSet = new Set(tags)
        if (!filter.tags.every(tag => tagSet.has(tag))) {
          matches = false
        }
      }
      
      // Filter by type
      if (filter.type && matches) {
        const type = group.group.attributes?.['bassline.type'] || 
                    group.group.attributes?.type
        if (type !== filter.type) {
          matches = false
        }
      }
      
      if (matches) {
        results.push(group)
      }
    }
    
    return this.ok(results)
  }
  
  // Versioning & Snapshots
  async saveSnapshot(
    networkId: NetworkId, 
    label?: string
  ): Promise<Result<SnapshotId, StorageError>> {
    const network = this.networks.get(networkId)
    if (!network) {
      return this.error('NETWORK_NOT_FOUND', `Network ${networkId} not found`)
    }
    
    const snapshotId = brand.snapshotId(`snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const snapshot: Snapshot = {
      id: snapshotId,
      networkId,
      label,
      state: {
        groups: new Map(network.groups) as any, // Type conversion needed due to branded types
        currentGroupId: 'root',
        rootGroupId: 'root'
      },
      createdAt: new Date()
    }
    
    this.snapshots.set(snapshotId, snapshot)
    return this.ok(snapshotId)
  }
  
  async loadSnapshot(
    networkId: NetworkId, 
    snapshotId: SnapshotId
  ): Promise<Result<NetworkState, StorageError>> {
    const snapshot = this.snapshots.get(snapshotId)
    if (!snapshot || snapshot.networkId !== networkId) {
      return this.error('SNAPSHOT_NOT_FOUND', `Snapshot ${snapshotId} not found for network ${networkId}`)
    }
    
    return this.ok(snapshot.state)
  }
  
  async listSnapshots(
    networkId: NetworkId
  ): Promise<Result<SnapshotInfo[], StorageError>> {
    const results: SnapshotInfo[] = []
    
    for (const snapshot of this.snapshots.values()) {
      if (snapshot.networkId === networkId) {
        results.push({
          id: snapshot.id,
          networkId: snapshot.networkId,
          label: snapshot.label,
          createdAt: snapshot.createdAt,
          size: JSON.stringify(snapshot.state).length
        })
      }
    }
    
    // Sort by creation date (newest first)
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    
    return this.ok(results)
  }
  
  async deleteSnapshot(
    networkId: NetworkId, 
    snapshotId: SnapshotId
  ): Promise<Result<void, StorageError>> {
    const snapshot = this.snapshots.get(snapshotId)
    if (snapshot && snapshot.networkId === networkId) {
      this.snapshots.delete(snapshotId)
    }
    
    return this.ok(undefined)
  }
  
  // Federation/Replication
  subscribe(path: string, callback: (state: GroupState) => void): Result<() => void, StorageError> {
    if (!this.subscriptions.has(path)) {
      this.subscriptions.set(path, new Set())
    }
    
    this.subscriptions.get(path)!.add(callback)
    
    // Return unsubscribe function
    const unsubscribe = () => {
      const callbacks = this.subscriptions.get(path)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.subscriptions.delete(path)
        }
      }
    }
    
    return this.ok(unsubscribe)
  }
  
  async sync(remote: NetworkStorage): Promise<Result<void, StorageError>> {
    try {
      // Simple sync: copy all networks from remote
      const networksResult = await remote.listNetworks()
      if (!networksResult.ok) {
        return networksResult
      }
      
      for (const networkId of networksResult.value) {
        const stateResult = await remote.loadNetworkState(networkId)
        if (stateResult.ok && stateResult.value) {
          await this.saveNetworkState(networkId, stateResult.value)
        }
      }
      
      return this.ok(undefined)
    } catch (error) {
      return this.error('STORAGE_CONNECTION_ERROR', 'Sync failed', error)
    }
  }
  
  // Lifecycle
  async initialize(): Promise<Result<void, StorageError>> {
    // Nothing to initialize for memory storage
    return this.ok(undefined)
  }
  
  async close(): Promise<Result<void, StorageError>> {
    // Clear all data
    this.networks.clear()
    this.snapshots.clear()
    this.subscriptions.clear()
    
    return this.ok(undefined)
  }
}

// Factory function
export function createMemoryStorage(config?: StorageConfig): NetworkStorage {
  return new MemoryStorage(config)
}