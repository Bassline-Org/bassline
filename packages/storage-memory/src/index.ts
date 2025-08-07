/**
 * In-memory storage implementation for Bassline
 */

import type { 
  NetworkStorage, 
  StorageConfig, 
  SnapshotInfo, 
  QueryFilter,
  GroupState,
  NetworkState 
} from '@bassline/core'

interface StoredNetwork {
  id: string
  groups: Map<string, GroupState>
  createdAt: Date
  updatedAt: Date
}

interface Snapshot {
  id: string
  networkId: string
  label?: string
  state: NetworkState
  createdAt: Date
}

export class MemoryStorage implements NetworkStorage {
  private networks = new Map<string, StoredNetwork>()
  private snapshots = new Map<string, Snapshot>()
  private subscriptions = new Map<string, Set<(state: GroupState) => void>>()
  
  constructor(config?: StorageConfig) {
    // Memory storage doesn't need configuration
  }
  
  // Contact Operations
  async saveContactContent(networkId: string, groupId: string, contactId: string, content: any): Promise<void> {
    const network = this.networks.get(networkId)
    if (!network) {
      throw new Error(`Network ${networkId} not found`)
    }
    
    const group = network.groups.get(groupId)
    if (!group) {
      throw new Error(`Group ${groupId} not found in network ${networkId}`)
    }
    
    const contact = group.group.contacts.get(contactId)
    if (contact) {
      contact.content = content
      network.updatedAt = new Date()
    }
  }
  
  async loadContactContent(networkId: string, groupId: string, contactId: string): Promise<any> {
    const network = this.networks.get(networkId)
    if (!network) return null
    
    const group = network.groups.get(groupId)
    if (!group) return null
    
    const contact = group.group.contacts.get(contactId)
    return contact?.content ?? null
  }
  
  // Group Operations
  async saveGroupState(networkId: string, groupId: string, state: GroupState): Promise<void> {
    let network = this.networks.get(networkId)
    if (!network) {
      network = {
        id: networkId,
        groups: new Map(),
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
      callbacks.forEach(cb => cb(state))
    }
  }
  
  async loadGroupState(networkId: string, groupId: string): Promise<GroupState | null> {
    const network = this.networks.get(networkId)
    if (!network) return null
    
    return network.groups.get(groupId) ?? null
  }
  
  async deleteGroup(networkId: string, groupId: string): Promise<void> {
    const network = this.networks.get(networkId)
    if (network) {
      network.groups.delete(groupId)
      network.updatedAt = new Date()
    }
  }
  
  // Network Operations
  async saveNetworkState(networkId: string, state: NetworkState): Promise<void> {
    const network: StoredNetwork = {
      id: networkId,
      groups: new Map(state.groups),
      createdAt: this.networks.get(networkId)?.createdAt ?? new Date(),
      updatedAt: new Date()
    }
    
    this.networks.set(networkId, network)
  }
  
  async loadNetworkState(networkId: string): Promise<NetworkState | null> {
    const network = this.networks.get(networkId)
    if (!network) return null
    
    return {
      groups: new Map(network.groups),
      currentGroupId: 'root',
      rootGroupId: 'root'
    }
  }
  
  async listNetworks(): Promise<string[]> {
    return Array.from(this.networks.keys())
  }
  
  async deleteNetwork(networkId: string): Promise<void> {
    this.networks.delete(networkId)
    
    // Delete associated snapshots
    for (const [id, snapshot] of this.snapshots) {
      if (snapshot.networkId === networkId) {
        this.snapshots.delete(id)
      }
    }
  }
  
  async exists(networkId: string): Promise<boolean> {
    return this.networks.has(networkId)
  }
  
  // Query Operations
  async queryGroups(networkId: string, filter: QueryFilter): Promise<GroupState[]> {
    const network = this.networks.get(networkId)
    if (!network) return []
    
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
    
    return results
  }
  
  // Versioning & Snapshots
  async saveSnapshot(networkId: string, label?: string): Promise<string> {
    const network = this.networks.get(networkId)
    if (!network) {
      throw new Error(`Network ${networkId} not found`)
    }
    
    const snapshotId = `snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const snapshot: Snapshot = {
      id: snapshotId,
      networkId,
      label,
      state: {
        groups: new Map(network.groups),
        currentGroupId: 'root',
        rootGroupId: 'root'
      },
      createdAt: new Date()
    }
    
    this.snapshots.set(snapshotId, snapshot)
    return snapshotId
  }
  
  async loadSnapshot(networkId: string, snapshotId: string): Promise<NetworkState> {
    const snapshot = this.snapshots.get(snapshotId)
    if (!snapshot || snapshot.networkId !== networkId) {
      throw new Error(`Snapshot ${snapshotId} not found for network ${networkId}`)
    }
    
    return snapshot.state
  }
  
  async listSnapshots(networkId: string): Promise<SnapshotInfo[]> {
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
    
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }
  
  async deleteSnapshot(networkId: string, snapshotId: string): Promise<void> {
    const snapshot = this.snapshots.get(snapshotId)
    if (snapshot && snapshot.networkId === networkId) {
      this.snapshots.delete(snapshotId)
    }
  }
  
  // Federation/Replication
  subscribe(path: string, callback: (state: GroupState) => void): () => void {
    if (!this.subscriptions.has(path)) {
      this.subscriptions.set(path, new Set())
    }
    
    this.subscriptions.get(path)!.add(callback)
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(path)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.subscriptions.delete(path)
        }
      }
    }
  }
  
  async sync(remote: NetworkStorage): Promise<void> {
    // Simple sync: copy all networks from remote
    const networkIds = await remote.listNetworks()
    
    for (const networkId of networkIds) {
      const state = await remote.loadNetworkState(networkId)
      if (state) {
        await this.saveNetworkState(networkId, state)
      }
    }
  }
  
  // Lifecycle
  async initialize(): Promise<void> {
    // Nothing to initialize for memory storage
  }
  
  async close(): Promise<void> {
    // Clear all data
    this.networks.clear()
    this.snapshots.clear()
    this.subscriptions.clear()
  }
}

// Factory function
export function createMemoryStorage(config?: StorageConfig): NetworkStorage {
  return new MemoryStorage(config)
}