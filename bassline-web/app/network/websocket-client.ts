// WebSocket-enabled client for connecting to a remote Bassline server
import type { NetworkClient, NetworkMessage, GroupState } from './client'
import type { Change } from '~/propagation-core-v2/types'

export class WebSocketNetworkClient implements NetworkClient {
  private serverUrl: string
  private wsUrl: string
  private ws: WebSocket | null = null
  private subscriptions = new Map<string, Array<(changes: Change[]) => void>>()
  private messageQueue: NetworkMessage[] = []
  private connected = false
  private reconnectTimeout: number | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  
  constructor(serverUrl: string) {
    this.serverUrl = serverUrl
    // Convert HTTP URL to WebSocket URL
    this.wsUrl = serverUrl.replace(/^http/, 'ws')
  }
  
  async initialize(scheduler: 'immediate' | 'batch' = 'immediate'): Promise<void> {
    console.log('[WebSocketClient] Initializing, connecting to:', this.wsUrl)
    
    return new Promise((resolve, reject) => {
      this.connect()
        .then(() => {
          console.log('[WebSocketClient] Connected successfully')
          resolve()
        })
        .catch(reject)
    })
  }
  
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl)
        
        this.ws.onopen = () => {
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
            const message = this.messageQueue.shift()!
            this.sendMessage(message)
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
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })
  }
  
  private handleServerMessage(message: any) {
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
      this.connect().catch(error => {
        console.error('[WebSocketClient] Reconnection failed:', error)
      })
    }, delay)
  }
  
  async getState(groupId: string): Promise<GroupState> {
    // Fallback to HTTP for immediate state queries
    console.log('[WebSocketClient] Getting state via HTTP for group:', groupId)
    const response = await fetch(`${this.serverUrl}/state?groupId=${groupId}`)
    if (!response.ok) {
      throw new Error(`Failed to get state: ${response.statusText}`)
    }
    const data = await response.json()
    
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
    // Use HTTP for all mutations
    switch (message.type) {
      case 'ADD_CONTACT':
        const addResponse = await fetch(`${this.serverUrl}/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId: message.groupId,
            contact: message.contact
          })
        })
        const { contactId } = await addResponse.json()
        return { contactId }
        
      case 'UPDATE_CONTACT':
        await fetch(`${this.serverUrl}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId: message.contactId,
            content: message.content
          })
        })
        return { success: true }
        
      case 'REMOVE_CONTACT':
        await fetch(`${this.serverUrl}/contact/${message.contactId}`, {
          method: 'DELETE'
        })
        return { success: true }
        
      case 'ADD_WIRE':
        const wireResponse = await fetch(`${this.serverUrl}/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromId: message.fromId,
            toId: message.toId,
            type: message.wireType || 'bidirectional'
          })
        })
        const { wireId } = await wireResponse.json()
        return { wireId }
        
      case 'REMOVE_WIRE':
        await fetch(`${this.serverUrl}/wire/${message.wireId}`, {
          method: 'DELETE'
        })
        return { success: true }
        
      case 'ADD_GROUP':
        const groupResponse = await fetch(`${this.serverUrl}/groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: message.group.name,
            parentId: message.parentId,
            primitiveId: message.group.primitiveId
          })
        })
        const { groupId } = await groupResponse.json()
        return { groupId }
        
      case 'REMOVE_GROUP':
        await fetch(`${this.serverUrl}/groups/${message.groupId}`, {
          method: 'DELETE'
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
    const response = await fetch(`${this.serverUrl}/groups`)
    return response.json()
  }
  
  async listPrimitives(): Promise<any[]> {
    const response = await fetch(`${this.serverUrl}/primitives`)
    return response.json()
  }
  
  async exportState(groupId?: string): Promise<any> {
    const response = await fetch(`${this.serverUrl}/state?groupId=${groupId || 'root'}`)
    return response.json()
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