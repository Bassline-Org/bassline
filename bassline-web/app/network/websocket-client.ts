// WebSocket-enabled client for connecting to a remote Bassline server
import type { NetworkClient, NetworkMessage, GroupState } from './client'
import type { Change } from '~/propagation-core-v2/types'

export class WebSocketNetworkClient implements NetworkClient {
  private wsUrl: string
  private ws: WebSocket | null = null
  private subscriptions = new Map<string, Array<(changes: Change[]) => void>>()
  private messageQueue: Array<{ message: any; resolve: (value: any) => void; reject: (error: any) => void }> = []
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: any) => void }>()
  private requestId = 0
  private connected = false
  private reconnectTimeout: number | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  
  constructor(serverUrl: string) {
    // Convert HTTP URL to WebSocket URL
    this.wsUrl = serverUrl.replace(/^http/, 'ws')
    console.log('[WebSocketClient] Constructor - Server URL:', serverUrl, '-> WS URL:', this.wsUrl)
  }
  
  async initialize(scheduler: 'immediate' | 'batch' = 'immediate'): Promise<void> {
    console.log('[WebSocketClient] Initializing, connecting to:', this.wsUrl)
    
    console.log('[WebSocketClient] About to call connectWebSocket()')
    try {
      await this.connectWebSocket()
      console.log('[WebSocketClient] Connected successfully')
    } catch (error) {
      console.error('[WebSocketClient] Connection failed:', error)
      throw error
    }
  }
  
  private async connectWebSocket(): Promise<void> {
    console.log('[WebSocketClient] Connect method called')
    return new Promise((resolve, reject) => {
      console.log('[WebSocketClient] Inside Promise constructor')
      try {
        console.log('[WebSocketClient] Creating WebSocket connection to:', this.wsUrl)
        this.ws = new WebSocket(this.wsUrl)
        console.log('[WebSocketClient] WebSocket object created:', this.ws)
        
        // Add connection timeout
        const connectTimeout = setTimeout(() => {
          if (!this.connected) {
            console.log('[WebSocketClient] Connection timeout!')
            this.ws?.close()
            reject(new Error('WebSocket connection timeout'))
          }
        }, 5000) // 5 second timeout
        
        this.ws.onopen = () => {
          clearTimeout(connectTimeout)
          console.log('[WebSocketClient] WebSocket connected')
          this.connected = true
          this.reconnectAttempts = 0
          
          // Subscribe to all groups we're tracking
          this.subscriptions.forEach((_, groupId) => {
            this.ws!.send(JSON.stringify({
              type: 'subscribe',
              groupId
            }))
          })
          
          // Process any queued messages
          while (this.messageQueue.length > 0) {
            const item = this.messageQueue.shift()!
            // Re-register the pending request
            this.pendingRequests.set(item.message.requestId, {
              resolve: item.resolve,
              reject: item.reject
            })
            this.ws!.send(JSON.stringify(item.message))
          }
          
          resolve()
        }
        
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            this.handleServerMessage(message)
          } catch (error) {
            console.error('[WebSocketClient] Error parsing message:', error)
          }
        }
        
        this.ws.onclose = () => {
          console.log('[WebSocketClient] WebSocket disconnected')
          this.connected = false
          this.ws = null
          this.attemptReconnect()
        }
        
        this.ws.onerror = (error) => {
          console.error('[WebSocketClient] WebSocket error:', error)
          if (!this.connected) {
            reject(new Error('Failed to connect to WebSocket'))
          }
        }
      } catch (error) {
        console.error('[WebSocketClient] Error creating WebSocket:', error)
        reject(error)
      }
    })
  }
  
  private handleServerMessage(message: any) {
    // Check if this is a response to a request
    if (message.requestId !== undefined) {
      const pending = this.pendingRequests.get(message.requestId)
      if (pending) {
        this.pendingRequests.delete(message.requestId)
        if (message.error) {
          pending.reject(new Error(message.error))
        } else {
          pending.resolve(message.data)
        }
        return
      }
    }
    
    // Handle push messages
    switch (message.type) {
      case 'state-update':
        // Initial state or full state update
        const handlers = this.subscriptions.get(message.groupId)
        if (handlers) {
          handlers.forEach(handler => handler([{
            type: 'state-update',
            data: message.state
          }]))
        }
        break
        
      case 'change':
        // Incremental change
        const changeHandlers = this.subscriptions.get(message.groupId)
        if (changeHandlers) {
          changeHandlers.forEach(handler => handler([message.change]))
        }
        break
        
      case 'error':
        console.error('[WebSocketClient] Server error:', message.error)
        break
    }
  }
  
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocketClient] Max reconnection attempts reached')
      return
    }
    
    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`[WebSocketClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    this.reconnectTimeout = window.setTimeout(() => {
      this.connectWebSocket().catch(error => {
        console.error('[WebSocketClient] Reconnection failed:', error)
      })
    }, delay)
  }
  
  private async sendRequest(type: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = String(this.requestId++)
      const message = {
        type,
        requestId,
        ...data
      }
      
      this.pendingRequests.set(requestId, { resolve, reject })
      
      if (this.connected && this.ws) {
        this.ws.send(JSON.stringify(message))
      } else {
        // Queue the message
        this.messageQueue.push({ message, resolve, reject })
      }
      
      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          reject(new Error(`Request ${type} timed out`))
        }
      }, 30000) // 30 second timeout
    })
  }
  
  async getState(groupId: string): Promise<GroupState> {
    console.log('[WebSocketClient] Getting state for group:', groupId)
    
    // If not connected yet, return empty state to allow UI to load
    if (!this.connected && groupId === 'root') {
      console.log('[WebSocketClient] Not connected yet, returning empty root state')
      return {
        group: {
          id: 'root',
          name: 'Root Group',
          contactIds: [],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts: new Map(),
        wires: new Map()
      }
    }
    
    const data = await this.sendRequest('get-state', { groupId })
    
    // Convert to our expected format
    return {
      group: data.group,
      contacts: new Map(Object.entries(data.contacts || {})),
      wires: new Map(Object.entries(data.wires || {}))
    }
  }
  
  subscribe(groupId: string, handler: (changes: Change[]) => void): () => void {
    if (!this.subscriptions.has(groupId)) {
      this.subscriptions.set(groupId, [])
      
      // If connected, subscribe immediately
      if (this.connected && this.ws) {
        this.ws.send(JSON.stringify({
          type: 'subscribe',
          groupId
        }))
      }
    }
    this.subscriptions.get(groupId)!.push(handler)
    
    return () => {
      const handlers = this.subscriptions.get(groupId)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index !== -1) {
          handlers.splice(index, 1)
        }
        
        // If no more handlers, unsubscribe
        if (handlers.length === 0) {
          this.subscriptions.delete(groupId)
          if (this.connected && this.ws) {
            this.ws.send(JSON.stringify({
              type: 'unsubscribe',
              groupId
            }))
          }
        }
      }
    }
  }
  
  async sendMessage(message: NetworkMessage): Promise<any> {
    // Convert NetworkMessage types to WebSocket message types
    switch (message.type) {
      case 'ADD_CONTACT':
        return this.sendRequest('add-contact', {
          groupId: message.groupId,
          contact: message.contact
        })
        
      case 'UPDATE_CONTACT':
        await this.sendRequest('update-contact', {
          contactId: message.contactId,
          content: message.content
        })
        return { success: true }
        
      case 'REMOVE_CONTACT':
        await this.sendRequest('remove-contact', {
          contactId: message.contactId
        })
        return { success: true }
        
      case 'ADD_WIRE':
        return this.sendRequest('add-wire', {
          fromId: message.fromId,
          toId: message.toId,
          wireType: message.wireType || 'bidirectional'
        })
        
      case 'REMOVE_WIRE':
        await this.sendRequest('remove-wire', {
          wireId: message.wireId
        })
        return { success: true }
        
      case 'ADD_GROUP':
        return this.sendRequest('add-group', {
          name: message.group.name,
          parentId: message.parentId,
          primitiveId: message.group.primitiveId
        })
        
      case 'REMOVE_GROUP':
        await this.sendRequest('remove-group', {
          groupId: message.groupId
        })
        return { success: true }
        
      default:
        throw new Error(`Unsupported message type: ${message.type}`)
    }
  }
  
  // Delegate methods
  async registerGroup(group: any): Promise<void> {
    if (group.id === 'root') return
    await this.sendMessage({
      type: 'ADD_GROUP',
      group,
      parentId: group.parentId || 'root'
    } as any)
  }
  
  async addContact(groupId: string, contact: any): Promise<string> {
    const result = await this.sendMessage({
      type: 'ADD_CONTACT',
      groupId,
      contact
    })
    return result.contactId
  }
  
  async updateContact(contactId: string, content: any): Promise<void> {
    await this.sendMessage({
      type: 'UPDATE_CONTACT',
      contactId,
      content
    })
  }
  
  async scheduleUpdate(contactId: string, content: any): Promise<void> {
    return this.updateContact(contactId, content)
  }
  
  async removeContact(contactId: string): Promise<void> {
    await this.sendMessage({
      type: 'REMOVE_CONTACT',
      contactId
    })
  }
  
  async addWire(fromId: string, toId: string, wireType: 'bidirectional' | 'directed' = 'bidirectional'): Promise<string> {
    const result = await this.sendMessage({
      type: 'ADD_WIRE',
      fromId,
      toId,
      wireType
    })
    return result.wireId
  }
  
  async connect(fromId: string, toId: string, type: 'bidirectional' | 'directed' = 'bidirectional'): Promise<string> {
    return this.addWire(fromId, toId, type)
  }
  
  async removeWire(wireId: string): Promise<void> {
    await this.sendMessage({
      type: 'REMOVE_WIRE',
      wireId
    })
  }
  
  async addGroup(parentId: string, group: any): Promise<string> {
    const result = await this.sendMessage({
      type: 'ADD_GROUP',
      parentId,
      group
    })
    return result.groupId
  }
  
  async removeGroup(groupId: string): Promise<void> {
    await this.sendMessage({
      type: 'REMOVE_GROUP',
      groupId
    })
  }
  
  // Other compatibility methods
  async listGroups(): Promise<any[]> {
    return this.sendRequest('list-groups', {})
  }
  
  async listPrimitives(): Promise<any[]> {
    return this.sendRequest('list-primitives', {})
  }
  
  async exportState(groupId?: string): Promise<any> {
    return this.sendRequest('get-state', { groupId: groupId || 'root' })
  }
  
  async importState(state: any): Promise<void> {
    throw new Error('Import not yet implemented for WebSocket client')
  }
  
  async applyRefactoring(refactoringType: string, params: any): Promise<any> {
    throw new Error('Refactoring not yet implemented for WebSocket client')
  }
  
  async getContact(contactId: string): Promise<any> {
    throw new Error('getContact not yet implemented for WebSocket client')
  }
  
  async subscribeToBatch(groupIds: string[], handler: (groupId: string, contacts: any[]) => void): () => void {
    const unsubscribes = groupIds.map(groupId => 
      this.subscribe(groupId, (changes) => {
        const stateUpdate = changes.find(c => c.type === 'state-update')
        if (stateUpdate && stateUpdate.data.contacts) {
          const contacts = Object.values(stateUpdate.data.contacts)
          handler(groupId, contacts)
        }
      })
    )
    
    return () => {
      unsubscribes.forEach(unsub => unsub())
    }
  }
  
  terminate(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    this.connected = false
    this.subscriptions.clear()
    this.messageQueue = []
  }
}