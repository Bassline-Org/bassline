import type { 
  PropagationNetworkScheduler,
  GroupState,
  Group,
  Contact,
  Wire,
  Change
} from '../types'
import type { WorkerRequest, WorkerResponse, WorkerNotification } from './network-worker'

export interface NetworkClientOptions {
  onChanges?: (changes: Change[]) => void
  onReady?: () => void
}

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
    this.worker.onmessage = (event: MessageEvent<WorkerResponse | WorkerNotification>) => {
      const message = event.data
      
      if ('id' in message) {
        // This is a response to a request
        console.log(`[NetworkClient] Received response:`, message)
        const pending = this.pendingRequests.get(message.id)
        if (pending) {
          this.pendingRequests.delete(message.id)
          if (message.type === 'success') {
            pending.resolve(message.data)
          } else {
            const error = new Error(message.error || 'Unknown error')
            console.error(`[NetworkClient] Request failed:`, message)
            pending.reject(error)
          }
        }
      } else {
        // This is a notification
        console.log(`[NetworkClient] Received notification:`, message.type)
        switch (message.type) {
          case 'changes':
            console.log(`[NetworkClient] Changes:`, message.data)
            this.notifySubscribers(message.data)
            break
          case 'ready':
            options.onReady?.()
            break
        }
      }
    }
    
    // Handle worker errors
    this.worker.onerror = (error) => {
      console.error('Worker error:', error)
    }
  }
  
  private async sendRequest(type: string, payload: any): Promise<any> {
    const id = crypto.randomUUID()
    const request: WorkerRequest = { id, type, payload }
    
    console.log(`[NetworkClient] Sending ${type} request:`, payload)
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })
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
    this.subscribers.forEach(callback => callback(changes))
  }
  
  // PropagationNetworkScheduler implementation
  
  async registerGroup(group: Group): Promise<void> {
    await this.sendRequest('REGISTER_GROUP', group)
  }
  
  async scheduleUpdate(contactId: string, content: unknown): Promise<void> {
    await this.sendRequest('UPDATE_CONTENT', { contactId, content })
  }
  
  async schedulePropagation(fromContactId: string, toContactId: string, content: unknown): Promise<void> {
    // The worker handles this internally through normal propagation
    await this.scheduleUpdate(toContactId, content)
  }
  
  async connect(fromId: string, toId: string, type?: 'bidirectional' | 'directed'): Promise<string> {
    const result = await this.sendRequest('CONNECT', { fromId, toId, type })
    return result.wireId
  }
  
  async disconnect(wireId: string): Promise<void> {
    await this.sendRequest('DISCONNECT', { wireId })
  }
  
  async addContact(groupId: string, contact: Omit<Contact, 'id'>): Promise<string> {
    const result = await this.sendRequest('ADD_CONTACT', { groupId, contact })
    return result.contactId
  }
  
  async removeContact(contactId: string): Promise<void> {
    await this.sendRequest('REMOVE_CONTACT', { contactId })
  }
  
  async addGroup(parentGroupId: string, group: Omit<Group, 'id' | 'parentId' | 'contactIds' | 'wireIds' | 'subgroupIds' | 'boundaryContactIds'> & { primitiveId?: string }): Promise<string> {
    const result = await this.sendRequest('ADD_GROUP', { parentId: parentGroupId, group })
    return result.groupId
  }
  
  async removeGroup(groupId: string): Promise<void> {
    await this.sendRequest('REMOVE_GROUP', { groupId })
  }
  
  async getState(groupId: string): Promise<GroupState> {
    const result = await this.sendRequest('GET_STATE', { groupId })
    
    // Convert arrays back to Maps
    const groupState = {
      group: result.group,
      contacts: new Map(result.contacts),
      wires: new Map(result.wires)
    }
    
    return groupState
  }
  
  async getContact(contactId: string): Promise<Contact | undefined> {
    return await this.sendRequest('GET_CONTACT', { contactId })
  }
  
  async getWire(wireId: string): Promise<Wire | undefined> {
    return await this.sendRequest('GET_WIRE', { wireId })
  }
  
  subscribe(callback: (changes: Change[]) => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }
  
  // Additional client methods
  
  async setScheduler(strategy: 'immediate' | 'batch', options?: any): Promise<void> {
    await this.sendRequest('SET_SCHEDULER', { strategy, options })
  }
  
  terminate(): void {
    this.worker.terminate()
  }
  
  // Refactoring operations
  
  async applyRefactoring(operation: string, params: any): Promise<any> {
    return await this.sendRequest('APPLY_REFACTORING', { operation, params })
  }
}