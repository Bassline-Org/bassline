/**
 * Network Client - Interface to the propagation network worker
 */

import type { 
  PropagationNetworkScheduler,
  GroupState,
  Group,
  Contact,
  Wire,
  Change
} from '@bassline/core'

export interface NetworkClientOptions {
  onChanges?: (changes: Change[]) => void
  onReady?: () => void
}

export interface WorkerRequest {
  id: string
  type: string
  data?: any
}

export interface WorkerResponse {
  id: string
  type: 'success' | 'error'
  data?: any
  error?: string
}

export interface WorkerNotification {
  type: 'changes' | 'ready'
  changes?: Change[]
}

export type NetworkMessage = WorkerResponse | WorkerNotification

export class NetworkClient implements PropagationNetworkScheduler {
  private worker: Worker
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void
    reject: (error: Error) => void
  }>()
  private subscribers = new Set<(changes: Change[]) => void>()
  
  constructor(options: NetworkClientOptions = {}) {
    // Create worker
    this.worker = new Worker(
      new URL('./network-worker.ts', import.meta.url),
      { type: 'module' }
    )
    
    // Add external subscriber if provided
    if (options.onChanges) {
      this.subscribers.add(options.onChanges)
    }
    
    // Handle messages from worker
    this.worker.onmessage = (event: MessageEvent<NetworkMessage>) => {
      const message = event.data
      
      if ('id' in message) {
        // This is a response to a request
        const pending = this.pendingRequests.get(message.id)
        if (pending) {
          this.pendingRequests.delete(message.id)
          if (message.type === 'success') {
            pending.resolve(message.data)
          } else {
            const error = new Error(message.error || 'Unknown error')
            pending.reject(error)
          }
        }
      } else {
        // This is a notification
        if (message.type === 'changes' && message.changes) {
          this.notifySubscribers(message.changes)
        } else if (message.type === 'ready' && options.onReady) {
          options.onReady()
        }
      }
    }
    
    // Handle worker errors
    this.worker.onerror = (error) => {
      console.error('[NetworkClient] Worker error:', error)
    }
  }
  
  private generateId(): string {
    return crypto.randomUUID()
  }
  
  private async sendRequest(type: string, data?: any): Promise<any> {
    const id = this.generateId()
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })
      
      const request: WorkerRequest = { id, type, data }
      this.worker.postMessage(request)
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Request ${type} timed out`))
        }
      }, 30000)
    })
  }
  
  private notifySubscribers(changes: Change[]) {
    this.subscribers.forEach(callback => {
      try {
        callback(changes)
      } catch (error) {
        console.error('[NetworkClient] Subscriber error:', error)
      }
    })
  }
  
  // PropagationNetworkScheduler implementation
  
  async registerGroup(group: Group): Promise<void> {
    await this.sendRequest('registerGroup', group)
  }
  
  async scheduleUpdate(contactId: string, content: unknown): Promise<void> {
    await this.sendRequest('scheduleUpdate', { contactId, content })
  }
  
  async schedulePropagation(fromContactId: string, toContactId: string, content: unknown): Promise<void> {
    await this.sendRequest('schedulePropagation', { fromContactId, toContactId, content })
  }
  
  async connect(fromId: string, toId: string, type?: 'bidirectional' | 'directed'): Promise<string> {
    return await this.sendRequest('connect', { fromId, toId, type })
  }
  
  async disconnect(wireId: string): Promise<void> {
    await this.sendRequest('disconnect', { wireId })
  }
  
  async addContact(groupId: string, contact: Omit<Contact, 'id'>): Promise<string> {
    return await this.sendRequest('addContact', { groupId, contact })
  }
  
  async removeContact(contactId: string): Promise<void> {
    await this.sendRequest('removeContact', { contactId })
  }
  
  async addGroup(parentGroupId: string, group: Omit<Group, 'id' | 'parentId' | 'contactIds' | 'wireIds' | 'subgroupIds' | 'boundaryContactIds'>): Promise<string> {
    return await this.sendRequest('addGroup', { parentGroupId, group })
  }
  
  async removeGroup(groupId: string): Promise<void> {
    await this.sendRequest('removeGroup', { groupId })
  }
  
  async getState(groupId: string): Promise<GroupState> {
    return await this.sendRequest('getState', { groupId })
  }
  
  async getContact(contactId: string): Promise<Contact | undefined> {
    return await this.sendRequest('getContact', { contactId })
  }
  
  async getWire(wireId: string): Promise<Wire | undefined> {
    return await this.sendRequest('getWire', { wireId })
  }
  
  subscribe(callback: (changes: Change[]) => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }
  
  // Additional methods for network management
  
  async setScheduler(scheduler: 'immediate' | 'batch' | 'animation-frame' | 'priority'): Promise<void> {
    await this.sendRequest('setScheduler', { scheduler })
  }
  
  destroy() {
    this.worker.terminate()
    this.pendingRequests.clear()
    this.subscribers.clear()
  }
}

// Re-export types
export type { GroupState, Contact, Wire, Change } from '@bassline/core'