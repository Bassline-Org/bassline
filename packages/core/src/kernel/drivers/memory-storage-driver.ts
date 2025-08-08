/**
 * Memory Storage Driver for Kernel
 * Simple in-memory storage implementation for testing and development
 */

import { NetworkStorage } from '../../storage/interface'
import type { StorageCapabilities } from '../driver'
import type { 
  GroupState, 
  GroupId, 
  ContactId, 
  NetworkId,
  NetworkState,
  SnapshotId,
  Serializable
} from '../../types'
import { brand } from '../../types'
import { DriverError } from '../types'

interface StoredData {
  groups: Map<GroupId, GroupState>
  contacts: Map<string, any> // "groupId:contactId" -> content
  networkState?: NetworkState
}

interface Snapshot {
  id: SnapshotId
  label?: string
  createdAt: Date
  data: StoredData
}

export class MemoryStorageDriver extends NetworkStorage {
  readonly id: string
  readonly name: string = 'memory-storage'
  readonly version: string = '1.0.0'
  
  private networks = new Map<string, StoredData>()
  private snapshots = new Map<string, Map<SnapshotId, Snapshot>>() // networkId -> snapshots
  private defaultNetworkId: NetworkId
  private isInitialized = false
  
  constructor(options: { id?: string; networkId?: string } = {}) {
    super()
    this.id = options.id || `memory-storage-${Date.now()}`
    this.defaultNetworkId = brand.networkId(options.networkId || 'default')
    
    // Initialize the network storage
    this.ensureNetwork(this.defaultNetworkId)
  }
  
  private ensureNetwork(networkId: NetworkId): StoredData {
    const netId = networkId as string
    if (!this.networks.has(netId)) {
      this.networks.set(netId, {
        groups: new Map(),
        contacts: new Map()
      })
      this.snapshots.set(netId, new Map())
    }
    return this.networks.get(netId)!
  }
  
  private contactKey(groupId: GroupId, contactId: ContactId): string {
    return `${groupId}:${contactId}`
  }
  
  // ============================================================================
  // NetworkStorage Abstract Method Implementations
  // ============================================================================
  
  async initialize(): Promise<void> {
    // Memory storage is always ready
    this.isInitialized = true
    this.ensureNetwork(this.defaultNetworkId)
  }
  
  async close(): Promise<void> {
    // Nothing to close for memory storage
    this.isInitialized = false
  }
  
  async isHealthy(): Promise<boolean> {
    // Memory storage is always healthy if initialized
    return this.isInitialized
  }
  
  getCapabilities(): StorageCapabilities {
    return {
      supportsBatching: false,
      supportsTransactions: false,
      supportsStreaming: false,
      persistent: false, // Memory storage is not persistent
    }
  }
  
  getDefaultNetworkId(): NetworkId {
    return this.defaultNetworkId
  }
  
  // ============================================================================
  // Contact Operations
  // ============================================================================
  
  async saveContactContent<T = unknown>(
    networkId: NetworkId,
    groupId: GroupId,
    contactId: ContactId,
    content: Serializable<T>
  ): Promise<void> {
    try {
      const storage = this.ensureNetwork(networkId)
      const key = this.contactKey(groupId, contactId)
      
      // Save the contact content
      storage.contacts.set(key, content)
    } catch (error: any) {
      throw new DriverError(
        `Failed to save contact ${contactId}: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async loadContactContent<T = unknown>(
    networkId: NetworkId,
    groupId: GroupId,
    contactId: ContactId
  ): Promise<T | null> {
    try {
      const storage = this.ensureNetwork(networkId)
      const key = this.contactKey(groupId, contactId)
      
      return storage.contacts.get(key) ?? null
    } catch (error: any) {
      throw new DriverError(
        `Failed to load contact ${contactId}: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  // ============================================================================
  // Group Operations
  // ============================================================================
  
  async saveGroupState(
    networkId: NetworkId,
    groupId: GroupId,
    state: GroupState
  ): Promise<void> {
    try {
      const storage = this.ensureNetwork(networkId)
      storage.groups.set(groupId, state)
    } catch (error: any) {
      throw new DriverError(
        `Failed to save group ${groupId}: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async loadGroupState(
    networkId: NetworkId,
    groupId: GroupId
  ): Promise<GroupState | null> {
    try {
      const storage = this.ensureNetwork(networkId)
      return storage.groups.get(groupId) ?? null
    } catch (error: any) {
      throw new DriverError(
        `Failed to load group ${groupId}: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async deleteGroup(
    networkId: NetworkId,
    groupId: GroupId
  ): Promise<void> {
    try {
      const storage = this.ensureNetwork(networkId)
      
      // Delete the group
      storage.groups.delete(groupId)
      
      // Delete all contacts in the group
      const keysToDelete: string[] = []
      for (const key of storage.contacts.keys()) {
        if (key.startsWith(`${groupId}:`)) {
          keysToDelete.push(key)
        }
      }
      
      for (const key of keysToDelete) {
        storage.contacts.delete(key)
      }
    } catch (error: any) {
      throw new DriverError(
        `Failed to delete group ${groupId}: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  // ============================================================================
  // Network Operations
  // ============================================================================
  
  async saveNetworkState(
    networkId: NetworkId,
    state: NetworkState
  ): Promise<void> {
    try {
      const storage = this.ensureNetwork(networkId)
      storage.networkState = state
    } catch (error: any) {
      throw new DriverError(
        `Failed to save network state: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async loadNetworkState(
    networkId: NetworkId
  ): Promise<NetworkState | null> {
    try {
      const storage = this.ensureNetwork(networkId)
      return storage.networkState ?? null
    } catch (error: any) {
      throw new DriverError(
        `Failed to load network state: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async deleteNetwork(networkId: NetworkId): Promise<void> {
    try {
      const netId = networkId as string
      this.networks.delete(netId)
      this.snapshots.delete(netId)
    } catch (error: any) {
      throw new DriverError(
        `Failed to delete network ${networkId}: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async exists(networkId: NetworkId): Promise<boolean> {
    try {
      const netId = networkId as string
      return this.networks.has(netId)
    } catch (error: any) {
      throw new DriverError(
        `Failed to check network existence: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async listNetworks(): Promise<NetworkId[]> {
    try {
      return Array.from(this.networks.keys()).map(id => brand.networkId(id))
    } catch (error: any) {
      throw new DriverError(
        `Failed to list networks: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  // ============================================================================
  // Snapshot Operations (Optional but implemented for memory storage)
  // ============================================================================
  
  async saveSnapshot(
    networkId: NetworkId,
    label?: string
  ): Promise<SnapshotId> {
    try {
      const storage = this.ensureNetwork(networkId)
      const netId = networkId as string
      
      // Create snapshot ID
      const snapshotId = brand.snapshotId(`snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
      
      // Deep copy the storage data
      const snapshot: Snapshot = {
        id: snapshotId,
        label,
        createdAt: new Date(),
        data: {
          groups: new Map(storage.groups),
          contacts: new Map(storage.contacts),
          networkState: storage.networkState
        }
      }
      
      // Store the snapshot
      if (!this.snapshots.has(netId)) {
        this.snapshots.set(netId, new Map())
      }
      this.snapshots.get(netId)!.set(snapshotId, snapshot)
      
      return snapshotId
    } catch (error: any) {
      throw new DriverError(
        `Failed to create snapshot: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async loadSnapshot(
    networkId: NetworkId,
    snapshotId: SnapshotId
  ): Promise<NetworkState> {
    try {
      const netId = networkId as string
      const snapshots = this.snapshots.get(netId)
      
      if (!snapshots) {
        throw new Error(`No snapshots found for network ${networkId}`)
      }
      
      const snapshot = snapshots.get(snapshotId)
      if (!snapshot) {
        throw new Error(`Snapshot ${snapshotId} not found`)
      }
      
      // Restore from snapshot
      const storage = this.ensureNetwork(networkId)
      storage.groups = new Map(snapshot.data.groups)
      storage.contacts = new Map(snapshot.data.contacts)
      storage.networkState = snapshot.data.networkState
      
      // Return the network state
      if (!snapshot.data.networkState) {
        throw new Error(`Snapshot ${snapshotId} has no network state`)
      }
      
      return snapshot.data.networkState
    } catch (error: any) {
      throw new DriverError(
        `Failed to load snapshot: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async listSnapshots(
    networkId: NetworkId
  ): Promise<Array<{ id: SnapshotId; label?: string; createdAt: Date }>> {
    try {
      const netId = networkId as string
      const snapshots = this.snapshots.get(netId)
      
      if (!snapshots) {
        return []
      }
      
      return Array.from(snapshots.values()).map(snapshot => ({
        id: snapshot.id,
        label: snapshot.label,
        createdAt: snapshot.createdAt
      }))
    } catch (error: any) {
      throw new DriverError(
        `Failed to list snapshots: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async deleteSnapshot(
    networkId: NetworkId,
    snapshotId: SnapshotId
  ): Promise<void> {
    try {
      const netId = networkId as string
      const snapshots = this.snapshots.get(netId)
      
      if (snapshots) {
        snapshots.delete(snapshotId)
      }
    } catch (error: any) {
      throw new DriverError(
        `Failed to delete snapshot: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  // ============================================================================
  // Test Helpers
  // ============================================================================
  
  /**
   * Get contact content for testing
   */
  getContactContent(groupId: GroupId, contactId: ContactId): any {
    const storage = this.ensureNetwork(this.defaultNetworkId)
    const key = this.contactKey(groupId, contactId)
    return storage.contacts.get(key)
  }
  
  /**
   * Get all stored data for testing
   */
  getAllData(): StoredData {
    return this.ensureNetwork(this.defaultNetworkId)
  }
  
  /**
   * Clear all data (for testing)
   */
  clearAll(): void {
    this.networks.clear()
    this.snapshots.clear()
    this.ensureNetwork(this.defaultNetworkId)
  }
}