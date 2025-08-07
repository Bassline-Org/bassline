// WebSocket-enabled client for connecting to a remote Bassline server
import type { NetworkClient, NetworkMessage, GroupState } from './client'
import type { Change } from '@bassline/core'

export class WebSocketNetworkClient implements NetworkClient {
  public readonly serverUrl: string // Add this property for ClientWrapper detection
  private wsUrl: string
  private ws: WebSocket | null = null
  private subscriptions = new Map<string, Array<(changes: Change[]) => void>>()
  private messageQueue: Array<{ message: any; resolve: (value: any) => void; reject: (error: any) => void }> = []
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: any) => void }>()
  private groupStates = new Map<string, any>()
  private requestId = 0
  private connected = false
  private reconnectTimeout: number | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  
  constructor(serverUrl: string) {
    this.serverUrl = serverUrl
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
          
          // Subscribe to all groups that have active handlers
          this.subscriptions.forEach((handlers, groupId) => {
            if (handlers.length > 0) {
              console.log('[WebSocketClient] Re-subscribing to group after reconnect:', groupId)
              this.ws!.send(JSON.stringify({
                type: 'subscribe',
                groupId
              }))
            }
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
        // Initial state or full state update (only sent once on subscribe)
        const handlers = this.subscriptions.get(message.groupId)
        if (handlers) {
          // Store the initial state for this group
          if (!this.groupStates) {
            this.groupStates = new Map()
          }
          this.groupStates.set(message.groupId, message.state)
          
          // Convert to proper GroupState format with Maps
          const groupState = {
            group: message.state.group,
            contacts: new Map(Object.entries(message.state.contacts || {})),
            wires: new Map(Object.entries(message.state.wires || {}))
          }
          
          handlers.forEach(handler => handler([{
            type: 'state-update',
            data: groupState
          }]))
        }
        break
        
      case 'change':
        // Incremental change - update our cached state and notify handlers
        console.log('[WebSocketClient] Received change for group:', message.groupId, message.change)
        const changeHandlers = this.subscriptions.get(message.groupId)
        if (changeHandlers) {
          console.log(`[WebSocketClient] Found ${changeHandlers.length} handlers for group ${message.groupId}`)
          // Apply the change to our cached state if we have one
          if (this.groupStates && this.groupStates.has(message.groupId)) {
            console.log('[WebSocketClient] Updating cached state for group:', message.groupId)
            this.applyChangeToState(message.groupId, message.change)
            console.log('[WebSocketClient] Cached state after update:', this.groupStates.get(message.groupId))
          } else {
            console.log('[WebSocketClient] No cached state for group:', message.groupId)
          }
          
          console.log('[WebSocketClient] Notifying handlers with change:', message.change)
          changeHandlers.forEach(handler => handler([message.change]))
        } else {
          console.log('[WebSocketClient] No handlers found for group:', message.groupId)
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
  
  private applyChangeToState(groupId: string, change: Change) {
    const state = this.groupStates.get(groupId)
    if (!state) return
    
    switch (change.type) {
      case 'contact-added':
        if (!state.contacts) state.contacts = {}
        const addData = change.data as any
        state.contacts[addData.contact.id] = addData.contact
        break
        
      case 'contact-updated':
        if (state.contacts && (change.data as any).contactId) {
          const data = change.data as any
          if (data.contact) {
            // Full contact provided
            state.contacts[data.contactId] = data.contact
          } else if (data.updates) {
            // Just updates provided
            state.contacts[data.contactId] = {
              ...state.contacts[data.contactId],
              ...data.updates
            }
          }
          console.log(`[WebSocketClient] Updated cached contact ${data.contactId} in group ${groupId}`)
        }
        break
        
      case 'contact-removed':
        if (state.contacts) {
          const removeData = change.data as any
          delete state.contacts[removeData.contactId]
        }
        break
        
      case 'wire-added':
        if (!state.wires) state.wires = {}
        const wireAddData = change.data as any
        state.wires[wireAddData.wire.id] = wireAddData.wire
        break
        
      case 'wire-removed':
        if (state.wires) {
          const wireRemoveData = change.data as any
          delete state.wires[wireRemoveData.wireId]
        }
        break
        
      case 'group-added':
        if (!state.group.subgroupIds) state.group.subgroupIds = []
        const groupAddData = change.data as any
        if (!state.group.subgroupIds.includes(groupAddData.group.id)) {
          state.group.subgroupIds.push(groupAddData.group.id)
        }
        break
        
      case 'group-removed':
        if (state.group.subgroupIds) {
          const groupRemoveData = change.data as any
          state.group.subgroupIds = state.group.subgroupIds.filter(
            (id: string) => id !== groupRemoveData.groupId
          )
        }
        break
    }
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
  
  async getState(groupId: string, forceRefresh = false): Promise<GroupState> {
    console.log('[WebSocketClient] Getting state for group:', groupId, 'forceRefresh:', forceRefresh)
    
    // Check if we have cached state for this group (unless forcing refresh)
    if (!forceRefresh && this.groupStates.has(groupId)) {
      console.log('[WebSocketClient] Using cached state for group:', groupId)
      const cachedState = this.groupStates.get(groupId)
      const result = {
        group: cachedState.group,
        contacts: new Map(Object.entries(cachedState.contacts || {})),
        wires: new Map(Object.entries(cachedState.wires || {}))
      }
      console.log('[WebSocketClient] Returning cached state with', result.contacts.size, 'contacts')
      return result
    }
    
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
    
    // Cache the state
    this.groupStates.set(groupId, data)
    
    // Convert to our expected format
    return {
      group: data.group,
      contacts: new Map(Object.entries(data.contacts || {})),
      wires: new Map(Object.entries(data.wires || {}))
    }
  }
  
  subscribe(groupId: string, handler: (changes: Change[]) => void): () => void {
    console.log('[WebSocketClient.subscribe] Called with groupId:', typeof groupId === 'string' ? groupId : 'NOT A STRING!', 'handler:', typeof handler)
    
    if (typeof groupId !== 'string') {
      console.error('[WebSocketClient.subscribe] ERROR: groupId is not a string, it is:', groupId)
      // Try to recover by using 'root' as default
      groupId = 'root'
    }
    
    if (!this.subscriptions.has(groupId)) {
      this.subscriptions.set(groupId, [])
    }
    
    const handlers = this.subscriptions.get(groupId)!
    const isFirstHandler = handlers.length === 0
    handlers.push(handler)
    
    // Subscribe on the server if this is the first handler for this group
    if (isFirstHandler && this.connected && this.ws) {
      console.log('[WebSocketClient] Subscribing to group:', groupId)
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        groupId
      }))
    }
    
    console.log(`[WebSocketClient] Added handler for group ${groupId}, total handlers: ${handlers.length}`)
    
    return () => {
      const handlers = this.subscriptions.get(groupId)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index !== -1) {
          handlers.splice(index, 1)
        }
        
        console.log(`[WebSocketClient] Removed handler for group ${groupId}, remaining handlers: ${handlers.length}`)
        
        // Don't unsubscribe immediately - use a timeout to handle React's rapid mount/unmount cycles
        if (handlers.length === 0) {
          setTimeout(() => {
            // Check again after timeout
            const currentHandlers = this.subscriptions.get(groupId)
            if (currentHandlers && currentHandlers.length === 0) {
              console.log('[WebSocketClient] No handlers left for group:', groupId, '- unsubscribing')
              this.subscriptions.delete(groupId)
              if (this.connected && this.ws) {
                this.ws.send(JSON.stringify({
                  type: 'unsubscribe',
                  groupId
                }))
              }
            }
          }, 100) // 100ms delay to handle React's double-render in dev mode
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