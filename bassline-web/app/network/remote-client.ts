// Client for connecting to a remote Bassline server
import type { NetworkClient, NetworkMessage, GroupState } from './client'

export class RemoteNetworkClient implements NetworkClient {
  private serverUrl: string
  private subscriptions = new Map<string, Array<(changes: any[]) => void>>()
  private pollInterval: NodeJS.Timeout | null = null
  private lastChangeTimestamp = 0
  
  constructor(serverUrl: string) {
    this.serverUrl = serverUrl
  }
  
  async initialize(scheduler: 'immediate' | 'batch' = 'immediate'): Promise<void> {
    console.log('[RemoteClient] Initializing, testing connection to:', this.serverUrl)
    
    // Test connection
    const response = await fetch(`${this.serverUrl}/state?groupId=root`)
    if (!response.ok) {
      throw new Error(`Failed to connect to server: ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log('[RemoteClient] Connection successful, root state:', data)
    
    // Start polling for changes (since we don't have WebSockets yet)
    this.startPolling()
  }
  
  async registerGroup(group: any): Promise<void> {
    // For remote client, we assume the server manages groups
    // This is mainly for compatibility with the worker client interface
    if (group.id === 'root') {
      // Root group should already exist on server
      return
    }
    
    // Otherwise create the group
    await this.sendMessage({
      type: 'ADD_GROUP',
      group,
      parentId: group.parentId || 'root'
    } as any)
  }
  
  private startPolling() {
    console.log('[RemoteClient] Starting polling for subscriptions')
    this.pollInterval = setInterval(async () => {
      // Poll each subscribed group for changes
      for (const [groupId, handlers] of this.subscriptions.entries()) {
        if (handlers.length > 0) {
          try {
            console.log('[RemoteClient] Polling group:', groupId)
            const response = await fetch(`${this.serverUrl}/state?groupId=${groupId}`)
            if (response.ok) {
              const rawState = await response.json()
              console.log('[RemoteClient] Received state update for group:', groupId)
              // Convert to our expected format with Maps
              const state = {
                group: rawState.group,
                contacts: new Map(Object.entries(rawState.contacts || {})),
                wires: new Map(Object.entries(rawState.wires || {}))
              }
              // Simple change detection - in a real implementation we'd track versions
              handlers.forEach(handler => handler([{ type: 'state-update', data: state }]))
            } else {
              console.error('[RemoteClient] Failed to poll group:', groupId, response.statusText)
            }
          } catch (error) {
            console.error('[RemoteClient] Polling error:', error)
          }
        }
      }
    }, 1000) // Poll every 1 second for easier debugging
  }
  
  async getState(groupId: string): Promise<GroupState> {
    console.log('[RemoteClient] Getting state for group:', groupId)
    const response = await fetch(`${this.serverUrl}/state?groupId=${groupId}`)
    if (!response.ok) {
      throw new Error(`Failed to get state: ${response.statusText}`)
    }
    const data = await response.json()
    console.log('[RemoteClient] Got state for group:', groupId, data)
    
    // Convert to our expected format
    return {
      group: data.group,
      contacts: new Map(Object.entries(data.contacts || {})),
      wires: new Map(Object.entries(data.wires || {}))
    }
  }
  
  subscribe(groupId: string, handler: (changes: any[]) => void): () => void {
    if (!this.subscriptions.has(groupId)) {
      this.subscriptions.set(groupId, [])
    }
    this.subscriptions.get(groupId)!.push(handler)
    
    return () => {
      const handlers = this.subscriptions.get(groupId)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index !== -1) {
          handlers.splice(index, 1)
        }
      }
    }
  }
  
  async sendMessage(message: NetworkMessage): Promise<any> {
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
    // This would need a new API endpoint
    throw new Error('Import not yet implemented for remote client')
  }
  
  async applyRefactoring(refactoringType: string, params: any): Promise<any> {
    // This would need new API endpoints for refactoring
    throw new Error('Refactoring not yet implemented for remote client')
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
    // For remote client, scheduleUpdate is the same as updateContact
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
    // For compatibility with worker client interface
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
  
  // Compatibility methods for worker client interface
  async getContact(contactId: string): Promise<any> {
    // This would need a new API endpoint
    throw new Error('getContact not yet implemented for remote client')
  }
  
  async subscribeToBatch(groupIds: string[], handler: (groupId: string, contacts: any[]) => void): () => void {
    // For now, just subscribe to each group individually
    const unsubscribes = groupIds.map(groupId => 
      this.subscribe(groupId, (changes) => {
        // Extract contacts from state update
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
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }
}