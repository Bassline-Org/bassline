/**
 * Remote WebSocket storage adapter
 * Proxies storage operations to a remote node via WebSocket
 */

import WebSocket from 'ws'
import type {
  NetworkStorage,
  StorageError,
  Result,
  NetworkId,
  GroupId,
  ContactId,
  GroupState,
  NetworkState,
  SnapshotId,
  SnapshotInfo,
  QueryFilter,
  Serializable
} from '@bassline/core'

export class RemoteWebSocketStorage implements NetworkStorage {
  private ws?: WebSocket
  private pendingRequests = new Map<string, { resolve: Function; reject: Function }>()
  private requestId = 0
  private connected = false
  private connectPromise?: Promise<void>
  
  constructor(private wsUrl: string) {}
  
  /**
   * Initialize connection to remote storage
   */
  async initialize(): Promise<Result<void, StorageError>> {
    if (this.connectPromise) {
      await this.connectPromise
      return { ok: true, value: undefined }
    }
    
    this.connectPromise = this.connect()
    
    try {
      await this.connectPromise
      return { ok: true, value: undefined }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: `Failed to connect to remote storage: ${error.message}`,
          details: error
        }
      }
    }
  }
  
  /**
   * Connect to remote storage server
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl)
      
      this.ws.on('open', () => {
        console.log(`[RemoteStorage] Connected to ${this.wsUrl}`)
        this.connected = true
        resolve()
      })
      
      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString())
          
          if (msg.requestId && this.pendingRequests.has(msg.requestId)) {
            const { resolve, reject } = this.pendingRequests.get(msg.requestId)!
            this.pendingRequests.delete(msg.requestId)
            
            if (msg.error) {
              reject(new Error(msg.error))
            } else {
              resolve(msg.result)
            }
          }
        } catch (error) {
          console.error('[RemoteStorage] Error parsing message:', error)
        }
      })
      
      this.ws.on('close', () => {
        console.log('[RemoteStorage] Disconnected')
        this.connected = false
        
        // Reject all pending requests
        for (const { reject } of this.pendingRequests.values()) {
          reject(new Error('Connection closed'))
        }
        this.pendingRequests.clear()
        
        // Attempt reconnect after delay
        setTimeout(() => {
          if (!this.connected) {
            this.connectPromise = this.connect()
          }
        }, 5000)
      })
      
      this.ws.on('error', (error) => {
        console.error('[RemoteStorage] WebSocket error:', error)
        reject(error)
      })
      
      // Timeout connection attempt
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'))
        }
      }, 10000)
    })
  }
  
  /**
   * Make a request to remote storage
   */
  private async request<T>(method: string, params: any[]): Promise<T> {
    if (!this.connected) {
      await this.initialize()
    }
    
    if (!this.ws || !this.connected) {
      throw new Error('Not connected to remote storage')
    }
    
    const id = String(++this.requestId)
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })
      
      this.ws!.send(JSON.stringify({
        requestId: id,
        method: `storage.${method}`,
        params
      }))
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Request timeout: ${method}`))
        }
      }, 30000)
    })
  }
  
  // Implement NetworkStorage interface
  
  async saveContactContent<T = unknown>(
    networkId: NetworkId,
    groupId: GroupId,
    contactId: ContactId,
    content: Serializable<T>
  ): Promise<Result<void, StorageError>> {
    try {
      await this.request('saveContactContent', [networkId, groupId, contactId, content])
      return { ok: true, value: undefined }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async loadContactContent<T = unknown>(
    networkId: NetworkId,
    groupId: GroupId,
    contactId: ContactId
  ): Promise<Result<T | null, StorageError>> {
    try {
      const result = await this.request<T | null>('loadContactContent', [networkId, groupId, contactId])
      return { ok: true, value: result }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async saveGroupState(
    networkId: NetworkId,
    groupId: GroupId,
    state: GroupState
  ): Promise<Result<void, StorageError>> {
    try {
      await this.request('saveGroupState', [networkId, groupId, state])
      return { ok: true, value: undefined }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async loadGroupState(
    networkId: NetworkId,
    groupId: GroupId
  ): Promise<Result<GroupState | null, StorageError>> {
    try {
      const result = await this.request<GroupState | null>('loadGroupState', [networkId, groupId])
      return { ok: true, value: result }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async deleteGroup(
    networkId: NetworkId,
    groupId: GroupId
  ): Promise<Result<void, StorageError>> {
    try {
      await this.request('deleteGroup', [networkId, groupId])
      return { ok: true, value: undefined }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async saveNetworkState(
    networkId: NetworkId,
    state: NetworkState
  ): Promise<Result<void, StorageError>> {
    try {
      await this.request('saveNetworkState', [networkId, state])
      return { ok: true, value: undefined }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async loadNetworkState(
    networkId: NetworkId
  ): Promise<Result<NetworkState | null, StorageError>> {
    try {
      const result = await this.request<NetworkState | null>('loadNetworkState', [networkId])
      return { ok: true, value: result }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async listNetworks(): Promise<Result<NetworkId[], StorageError>> {
    try {
      const result = await this.request<NetworkId[]>('listNetworks', [])
      return { ok: true, value: result }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async deleteNetwork(
    networkId: NetworkId
  ): Promise<Result<void, StorageError>> {
    try {
      await this.request('deleteNetwork', [networkId])
      return { ok: true, value: undefined }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async exists(
    networkId: NetworkId
  ): Promise<Result<boolean, StorageError>> {
    try {
      const result = await this.request<boolean>('exists', [networkId])
      return { ok: true, value: result }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async queryGroups(
    networkId: NetworkId,
    filter: QueryFilter
  ): Promise<Result<GroupState[], StorageError>> {
    try {
      const result = await this.request<GroupState[]>('queryGroups', [networkId, filter])
      return { ok: true, value: result }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async createSnapshot(
    networkId: NetworkId,
    label?: string
  ): Promise<Result<SnapshotId, StorageError>> {
    try {
      const result = await this.request<SnapshotId>('createSnapshot', [networkId, label])
      return { ok: true, value: result }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async restoreSnapshot(
    snapshotId: SnapshotId
  ): Promise<Result<void, StorageError>> {
    try {
      await this.request('restoreSnapshot', [snapshotId])
      return { ok: true, value: undefined }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async listSnapshots(
    networkId: NetworkId
  ): Promise<Result<SnapshotInfo[], StorageError>> {
    try {
      const result = await this.request<SnapshotInfo[]>('listSnapshots', [networkId])
      return { ok: true, value: result }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async deleteSnapshot(
    networkId: NetworkId,
    snapshotId: SnapshotId
  ): Promise<Result<void, StorageError>> {
    try {
      await this.request('deleteSnapshot', [networkId, snapshotId])
      return { ok: true, value: undefined }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async saveSnapshot(
    networkId: NetworkId,
    label?: string
  ): Promise<Result<SnapshotId, StorageError>> {
    try {
      const result = await this.request<SnapshotId>('saveSnapshot', [networkId, label])
      return { ok: true, value: result }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async loadSnapshot(
    networkId: NetworkId,
    snapshotId: SnapshotId
  ): Promise<Result<NetworkState, StorageError>> {
    try {
      const result = await this.request<NetworkState>('loadSnapshot', [networkId, snapshotId])
      return { ok: true, value: result }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  /**
   * Close connection
   */
  async close(): Promise<Result<void, StorageError>> {
    if (this.ws) {
      this.ws.close()
      this.ws = undefined
    }
    this.connected = false
    this.pendingRequests.clear()
    return { ok: true, value: undefined }
  }
}

export function createRemoteWebSocketStorage(wsUrl: string): NetworkStorage {
  return new RemoteWebSocketStorage(wsUrl)
}