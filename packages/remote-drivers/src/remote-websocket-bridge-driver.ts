/**
 * Remote WebSocket Bridge Driver (Client-side)
 * 
 * Connects to a remote Bassline server via WebSocket
 * Relays all operations to the server and receives changes back
 */

import { AbstractBridgeDriver, type ContactChange, type ExternalInput, type DriverCommand, type CommandResponse, DriverError } from '@bassline/core'

export interface RemoteWebSocketBridgeConfig {
  url: string
  autoReconnect?: boolean
  reconnectDelay?: number
  maxReconnectAttempts?: number
  id?: string
}

export interface WebSocketMessage {
  type: string
  data?: any
  requestId?: string
  groupId?: string
  contactId?: string
  value?: any
  content?: any
  error?: string
  name?: string
  parentId?: string
  fromId?: string
  toId?: string
  includeContacts?: boolean
  includeWires?: boolean
  includeSubgroups?: boolean
  [key: string]: any  // Allow additional properties
}

/**
 * Client-side bridge driver that connects to a remote Bassline server
 * All operations are passed through to the server
 */
export class RemoteWebSocketBridgeDriver extends AbstractBridgeDriver {
  private ws: WebSocket | null = null
  private config: Required<RemoteWebSocketBridgeConfig>
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void
    reject: (error: any) => void
  }>()
  private requestCounter = 0
  private reconnectAttempts = 0
  private reconnectTimeout: number | null = null
  private messageQueue: WebSocketMessage[] = []
  private subscriptions = new Set<string>()
  
  constructor(config: RemoteWebSocketBridgeConfig) {
    super({
      id: config.id || 'remote-websocket-bridge',
      name: 'remote-websocket-bridge',
      version: '1.0.0'
    })
    
    this.config = {
      url: config.url,
      autoReconnect: config.autoReconnect ?? true,
      reconnectDelay: config.reconnectDelay ?? 1000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      id: config.id || 'remote-websocket-bridge'
    }
  }
  
  // ============================================================================
  // WebSocket Management
  // ============================================================================
  
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // For browser environment
        this.ws = new WebSocket(this.config.url)
        
        this.ws.onopen = () => {
          console.log('[RemoteWebSocketBridge] Connected to', this.config.url)
          this.reconnectAttempts = 0
          
          // Re-subscribe to groups
          this.subscriptions.forEach(groupId => {
            this.send({ type: 'subscribe', groupId })
          })
          
          // Flush queued messages
          while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift()!
            this.send(msg)
          }
          
          this.emit('connected')
          resolve()
        }
        
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WebSocketMessage
            this.handleMessage(message)
          } catch (error) {
            console.error('[RemoteWebSocketBridge] Failed to parse message:', error)
          }
        }
        
        this.ws.onerror = (error) => {
          console.error('[RemoteWebSocketBridge] WebSocket error:', error)
          this.emit('error', error)
        }
        
        this.ws.onclose = () => {
          console.log('[RemoteWebSocketBridge] Disconnected')
          this.ws = null
          this.emit('disconnected')
          
          // Auto-reconnect if enabled
          if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect()
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return
    
    this.reconnectAttempts++
    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`[RemoteWebSocketBridge] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null
      this.connect().catch(error => {
        console.error('[RemoteWebSocketBridge] Reconnection failed:', error)
      })
    }, delay) as any
  }
  
  private send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      // Queue message for when we reconnect
      this.messageQueue.push(message)
    }
  }
  
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'change':
        // Forward change to UI
        this.emit('change', message.data as ContactChange)
        break
        
      case 'welcome':
      case 'subscribed':
      case 'created':
      case 'updated':
      case 'pong':
        // Handle responses with request IDs
        if (message.requestId) {
          const pending = this.pendingRequests.get(message.requestId)
          if (pending) {
            this.pendingRequests.delete(message.requestId)
            pending.resolve(message.data || message)
          }
        }
        // Also emit for general listeners
        this.emit(message.type, message)
        break
        
      case 'error':
        if (message.requestId) {
          const pending = this.pendingRequests.get(message.requestId)
          if (pending) {
            this.pendingRequests.delete(message.requestId)
            pending.reject(new Error(message.error || 'Server error'))
          }
        } else {
          this.emit('error', new Error(message.error || 'Server error'))
        }
        break
        
      default:
        // Handle query results and other messages
        if (message.requestId) {
          const pending = this.pendingRequests.get(message.requestId)
          if (pending) {
            this.pendingRequests.delete(message.requestId)
            pending.resolve(message.data || message)
          }
        }
        break
    }
  }
  
  // ============================================================================
  // AbstractBridgeDriver Implementation
  // ============================================================================
  
  protected async onStartListening(): Promise<void> {
    await this.connect()
  }
  
  protected async onStopListening(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
  
  protected async onHandleChange(change: ContactChange): Promise<void> {
    // This is client-side, we don't handle changes from kernel
    // Changes come from the server via WebSocket
  }
  
  protected async onInitialize(): Promise<void> {
    // Nothing special to initialize
  }
  
  protected async onShutdown(force: boolean): Promise<void> {
    await this.onStopListening()
  }
  
  protected async onHealthCheck(): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false
    }
    
    // Send ping and wait for pong
    const requestId = `ping-${++this.requestCounter}`
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        resolve(false)
      }, 1000)
      
      this.pendingRequests.set(requestId, {
        resolve: () => {
          clearTimeout(timeout)
          resolve(true)
        },
        reject: () => {
          clearTimeout(timeout)
          resolve(false)
        }
      })
      
      this.send({ type: 'ping', requestId })
    })
  }
  
  protected async onHandleCommand(command: DriverCommand): Promise<CommandResponse> {
    throw new DriverError(
      'RemoteWebSocketBridge does not handle commands directly',
      { fatal: false }
    )
  }
  
  // ============================================================================
  // Public Methods for Full Client Capabilities
  // ============================================================================
  
  /**
   * Subscribe to a group for changes
   */
  async subscribe(groupId: string): Promise<void> {
    this.subscriptions.add(groupId)
    const requestId = `sub-${++this.requestCounter}`
    
    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, {
        resolve: () => resolve(),
        reject: () => resolve() // Don't fail on subscription errors
      })
      
      this.send({
        type: 'subscribe',
        groupId,
        requestId
      })
      
      // Timeout after 2 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          resolve()
        }
      }, 2000)
    })
  }
  
  /**
   * Unsubscribe from a group
   */
  async unsubscribe(groupId: string): Promise<void> {
    this.subscriptions.delete(groupId)
    this.send({
      type: 'unsubscribe',
      groupId
    })
  }
  
  /**
   * Add a contact to a group
   */
  async addContact(groupId: string, content: any): Promise<string> {
    const requestId = `add-${++this.requestCounter}`
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve: (result: any) => resolve(result.id || result.contactId || 'unknown'),
        reject
      })
      
      this.send({
        type: 'addContact',
        groupId,
        content,
        requestId
      })
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          reject(new Error('Operation timeout'))
        }
      }, 5000)
    })
  }
  
  /**
   * Update a contact's value
   */
  async updateContact(contactId: string, groupId: string, value: any): Promise<void> {
    this.send({
      type: 'updateContact',
      contactId,
      groupId,
      value
    })
  }
  
  /**
   * Create a new group
   */
  async createGroup(name: string, parentId?: string): Promise<string> {
    const requestId = `group-${++this.requestCounter}`
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve: (result: any) => resolve(result.id || result.groupId || 'unknown'),
        reject
      })
      
      this.send({
        type: 'createGroup',
        name,
        parentId,
        requestId
      })
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          reject(new Error('Operation timeout'))
        }
      }, 5000)
    })
  }
  
  /**
   * Create a wire between contacts
   */
  async createWire(fromId: string, toId: string): Promise<string> {
    const requestId = `wire-${++this.requestCounter}`
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve: (result: any) => resolve(result.id || result.wireId || 'unknown'),
        reject
      })
      
      this.send({
        type: 'createWire',
        fromId,
        toId,
        requestId
      })
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          reject(new Error('Operation timeout'))
        }
      }, 5000)
    })
  }
  
  /**
   * Query a group's state
   */
  async queryGroup(groupId: string, options?: {
    includeContacts?: boolean
    includeWires?: boolean
    includeSubgroups?: boolean
  }): Promise<any> {
    const requestId = `query-${++this.requestCounter}`
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve,
        reject
      })
      
      this.send({
        type: 'queryGroup',
        groupId,
        ...options,
        requestId
      })
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          reject(new Error('Query timeout'))
        }
      }, 5000)
    })
  }
  
  /**
   * Query a contact's value
   */
  async queryContact(contactId: string): Promise<any> {
    const requestId = `query-${++this.requestCounter}`
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve,
        reject
      })
      
      this.send({
        type: 'queryContact',
        contactId,
        requestId
      })
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          reject(new Error('Query timeout'))
        }
      }, 5000)
    })
  }
}