/**
 * Network Client V2 - Refactored with strong domain types
 */

import type { 
  GroupState,
  Group,
  Contact,
  Wire,
  Change,
  ContactId,
  GroupId,
  WireId,
  NetworkRequest,
  NetworkResponse,
  NetworkNotification,
  NetworkClient as INetworkClient,
  NetworkMode,
  NetworkError,
  ConnectionState,
  Result
} from '@bassline/core'
import { isResponse, isNotification } from '@bassline/core'
import { brand } from '@bassline/core'

export interface NetworkClientOptions {
  onChanges?: (changes: Change[]) => void
  onReady?: () => void
  onError?: (error: NetworkError) => void
  onStateChange?: (state: ConnectionState) => void
}

/**
 * Worker-based NetworkClient implementation
 * Implements INetworkClient interface and provides PropagationNetworkScheduler methods
 */
export class NetworkClient implements INetworkClient {
  private worker: Worker
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void
    reject: (error: NetworkError) => void
  }>()
  private subscribers = new Set<(notification: NetworkNotification) => void>()
  private changeSubscribers = new Set<(changes: Change[]) => void>()
  private connectionState: ConnectionState = 'disconnected'
  private options: NetworkClientOptions
  
  constructor(options: NetworkClientOptions = {}) {
    this.options = options
    
    // Create worker
    this.worker = new Worker(
      new URL('./network-worker.ts', import.meta.url),
      { type: 'module' }
    )
    
    // Add external change subscriber if provided
    if (options.onChanges) {
      this.changeSubscribers.add(options.onChanges)
    }
    
    // Set up message handler
    this.setupMessageHandler()
    
    // Set up error handler
    this.worker.onerror = (error) => {
      console.error('[NetworkClient] Worker error:', error)
      this.handleError({
        code: 'INTERNAL_ERROR',
        message: 'Worker error',
        details: error
      })
    }
    
    // Connect automatically
    this.connect()
  }
  
  private setupMessageHandler() {
    this.worker.onmessage = (event: MessageEvent) => {
      const message = event.data
      
      if (isResponse(message)) {
        this.handleResponse(message)
      } else if (isNotification(message)) {
        this.handleNotification(message)
      }
    }
  }
  
  private handleResponse(response: NetworkResponse) {
    const pending = this.pendingRequests.get(response.id)
    if (pending) {
      this.pendingRequests.delete(response.id)
      if (response.result.ok) {
        pending.resolve(response.result.value)
      } else {
        pending.reject(response.result.error)
      }
    }
  }
  
  private handleNotification(notification: NetworkNotification) {
    // Notify all subscribers
    this.subscribers.forEach(handler => {
      try {
        handler(notification)
      } catch (error) {
        console.error('[NetworkClient] Subscriber error:', error)
      }
    })
    
    // Handle specific notification types
    switch (notification.type) {
      case 'changes':
        this.handleChanges(notification.changes)
        break
      case 'ready':
        this.handleReady()
        break
      case 'error':
        this.handleError(notification.error)
        break
      case 'stateChanged':
        // Handle state change if needed
        break
    }
  }
  
  private handleChanges(changes: Change[]) {
    this.changeSubscribers.forEach(callback => {
      try {
        callback(changes)
      } catch (error) {
        console.error('[NetworkClient] Change subscriber error:', error)
      }
    })
  }
  
  private handleReady() {
    this.connectionState = 'connected'
    this.options.onStateChange?.('connected')
    this.options.onReady?.()
  }
  
  private handleError(error: NetworkError) {
    this.connectionState = 'error'
    this.options.onStateChange?.('error')
    this.options.onError?.(error)
  }
  
  // INetworkClient implementation
  
  async request<T>(request: NetworkRequest): Promise<Result<T, NetworkError>> {
    return new Promise((resolve) => {
      const id = request.id || crypto.randomUUID()
      
      this.pendingRequests.set(id, {
        resolve: (value) => resolve({ ok: true, value }),
        reject: (error) => resolve({ ok: false, error })
      })
      
      this.worker.postMessage({ ...request, id })
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          resolve({
            ok: false,
            error: {
              code: 'TIMEOUT',
              message: `Request ${request.type} timed out`
            }
          })
        }
      }, 30000)
    })
  }
  
  subscribe(handler: (notification: NetworkNotification) => void): () => void {
    this.subscribers.add(handler)
    return () => this.subscribers.delete(handler)
  }
  
  subscribeToNotifications(handler: (notification: NetworkNotification) => void): () => void {
    return this.subscribe(handler)
  }
  
  async connect(): Promise<Result<void, NetworkError>> {
    this.connectionState = 'connecting'
    this.options.onStateChange?.('connecting')
    
    // Worker is always "connected" once created
    // Wait for ready notification
    return { ok: true, value: undefined }
  }
  
  async disconnect(): Promise<void>
  async disconnect(wireId: string): Promise<void>
  async disconnect(wireId?: string): Promise<void> {
    // If no wireId, this is disconnecting the client
    if (wireId === undefined) {
      this.connectionState = 'disconnected'
      this.options.onStateChange?.('disconnected')
      this.worker.terminate()
    } else {
      // Otherwise, this is disconnecting a wire
      await this.disconnectContacts(wireId)
    }
  }
  
  isConnected(): boolean {
    return this.connectionState === 'connected'
  }
  
  getMode(): NetworkMode {
    return 'worker'
  }
  
  // PropagationNetworkScheduler implementation
  
  async registerGroup(group: Group): Promise<void> {
    const result = await this.request<void>({
      type: 'registerGroup',
      id: crypto.randomUUID(),
      data: group
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
  }
  
  async scheduleUpdate(contactId: string, content: unknown): Promise<void> {
    const result = await this.request<void>({
      type: 'scheduleUpdate',
      id: crypto.randomUUID(),
      data: {
        contactId: brand.contactId(contactId),
        content
      }
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
  }
  
  async schedulePropagation(fromContactId: string, toContactId: string, content: unknown): Promise<void> {
    const result = await this.request<void>({
      type: 'schedulePropagation',
      id: crypto.randomUUID(),
      data: {
        fromContactId: brand.contactId(fromContactId),
        toContactId: brand.contactId(toContactId),
        content
      }
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
  }
  
  async connectContacts(fromId: string, toId: string, type?: 'bidirectional' | 'directed'): Promise<string> {
    const result = await this.request<WireId>({
      type: 'connect',
      id: crypto.randomUUID(),
      data: {
        fromId: brand.contactId(fromId),
        toId: brand.contactId(toId),
        wireType: type
      }
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
    
    return result.value
  }
  
  async disconnectContacts(wireId: string): Promise<void> {
    const result = await this.request<void>({
      type: 'disconnect',
      id: crypto.randomUUID(),
      data: {
        wireId: brand.wireId(wireId)
      }
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
  }
  
  // Alias for removeWire (API compatibility)
  async removeWire(wireId: string): Promise<void> {
    return this.disconnectContacts(wireId)
  }
  
  async addContact(groupId: string, contact: Omit<Contact, 'id'>): Promise<string> {
    const result = await this.request<ContactId>({
      type: 'addContact',
      id: crypto.randomUUID(),
      data: {
        groupId: brand.groupId(groupId),
        contact
      }
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
    
    return result.value
  }
  
  async removeContact(contactId: string): Promise<void> {
    const result = await this.request<void>({
      type: 'removeContact',
      id: crypto.randomUUID(),
      data: {
        contactId: brand.contactId(contactId)
      }
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
  }
  
  async addGroup(parentGroupId: string, group: Omit<Group, 'id' | 'parentId' | 'contactIds' | 'wireIds' | 'subgroupIds' | 'boundaryContactIds'>): Promise<string> {
    const result = await this.request<GroupId>({
      type: 'addGroup',
      id: crypto.randomUUID(),
      data: {
        parentGroupId: brand.groupId(parentGroupId),
        group
      }
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
    
    return result.value
  }
  
  async removeGroup(groupId: string): Promise<void> {
    const result = await this.request<void>({
      type: 'removeGroup',
      id: crypto.randomUUID(),
      data: {
        groupId: brand.groupId(groupId)
      }
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
  }
  
  async getState(groupId: string): Promise<GroupState> {
    const result = await this.request<GroupState>({
      type: 'getState',
      id: crypto.randomUUID(),
      data: {
        groupId: brand.groupId(groupId)
      }
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
    
    return result.value
  }
  
  async getContact(contactId: string): Promise<Contact | undefined> {
    const result = await this.request<Contact | undefined>({
      type: 'getContact',
      id: crypto.randomUUID(),
      data: {
        contactId: brand.contactId(contactId)
      }
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
    
    return result.value
  }
  
  async getWire(wireId: string): Promise<Wire | undefined> {
    const result = await this.request<Wire | undefined>({
      type: 'getWire',
      id: crypto.randomUUID(),
      data: {
        wireId: brand.wireId(wireId)
      }
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
    
    return result.value
  }
  
  subscribeToChanges(callback: (changes: Change[]) => void): () => void {
    this.changeSubscribers.add(callback)
    return () => this.changeSubscribers.delete(callback)
  }
  
  // Additional methods
  
  async setScheduler(scheduler: 'immediate' | 'batch' | 'animation-frame' | 'priority'): Promise<void> {
    const result = await this.request<void>({
      type: 'setScheduler',
      id: crypto.randomUUID(),
      data: { scheduler }
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
  }
  
  async applyRefactoring(operation: string, params: any): Promise<any> {
    const result = await this.request<any>({
      type: 'applyRefactoring',
      id: crypto.randomUUID(),
      data: { operation, params }
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
    
    return result.value
  }

  // Primitive management methods
  async listPrimitives(): Promise<string[]> {
    const result = await this.request<string[]>({
      type: 'listPrimitives',
      id: crypto.randomUUID(),
      data: {}
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
    
    return result.value
  }

  async listPrimitiveInfo(): Promise<any[]> {
    const result = await this.request<any[]>({
      type: 'listPrimitiveInfo',
      id: crypto.randomUUID(),
      data: {}
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
    
    return result.value
  }

  async getPrimitiveInfo(qualifiedName: string): Promise<any> {
    const result = await this.request<any>({
      type: 'getPrimitiveInfo',
      id: crypto.randomUUID(),
      data: { qualifiedName }
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
    
    return result.value
  }

  // Scheduler management methods
  async listSchedulers(): Promise<string[]> {
    const result = await this.request<string[]>({
      type: 'listSchedulers',
      id: crypto.randomUUID(),
      data: {}
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
    
    return result.value
  }

  async getSchedulerInfo(schedulerId: string): Promise<any> {
    const result = await this.request<any>({
      type: 'getSchedulerInfo',
      id: crypto.randomUUID(),
      data: { schedulerId }
    })
    
    if (!result.ok) {
      throw new Error(result.error.message)
    }
    
    return result.value
  }
  
  destroy() {
    this.disconnect()
    this.pendingRequests.clear()
    this.subscribers.clear()
    this.changeSubscribers.clear()
  }
}

// Re-export types
export type { GroupState, Contact, Wire, Change, NetworkError, NetworkNotification } from '@bassline/core'