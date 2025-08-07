import type { NetworkClient } from './network-client'
import type { RemoteNetworkClient } from './remote-client'
import type { WebSocketNetworkClient } from './websocket-client'
import type { NativeWebRTCClient } from './webrtc-native-client'
import type { 
  Change, 
  Contact, 
  Group, 
  GroupState, 
  ContactId, 
  GroupId, 
  WireId,
  Result,
  NetworkError
} from '@bassline/core'
import { brand } from '@bassline/core'

/**
 * Wrapper that provides a consistent interface for all client types
 * Uses strong domain types from @bassline/core
 */
export class ClientWrapper {
  private client: NetworkClient | RemoteNetworkClient | WebSocketNetworkClient | NativeWebRTCClient
  private isRemote: boolean
  
  constructor(client: NetworkClient | RemoteNetworkClient | WebSocketNetworkClient | NativeWebRTCClient) {
    this.client = client
    // Check if this is a remote client (WebSocket or WebRTC)
    this.isRemote = 'serverUrl' in client || 'config' in client
  }
  
  /**
   * Subscribe to changes with automatic client type detection
   * For remote clients, if groupId is provided, it subscribes to that specific group
   * For worker clients, groupId is ignored
   */
  subscribe(
    handlerOrGroupId: ((changes: Change[]) => void) | string,
    handler?: (changes: Change[]) => void
  ): () => void {
    if (this.isRemote) {
      // Remote client: use subscribeToGroup for group-specific subscriptions
      if (typeof handlerOrGroupId === 'string' && handler) {
        return (this.client as RemoteNetworkClient).subscribeToGroup(handlerOrGroupId, handler)
      } else if (typeof handlerOrGroupId === 'function') {
        // No groupId provided, subscribe to root
        console.warn('[ClientWrapper] Remote client subscribe called without groupId, defaulting to root')
        return (this.client as RemoteNetworkClient).subscribeToGroup('root', handlerOrGroupId)
      } else {
        throw new Error('Invalid arguments for remote client subscribe')
      }
    } else {
      // Worker client: subscribe(handler)
      if (typeof handlerOrGroupId === 'function') {
        return (this.client as any).subscribeToChanges?.(handlerOrGroupId) ?? (() => {})
      } else if (typeof handler === 'function') {
        // GroupId provided but not needed for worker client  
        // Just pass the handler, ignore the groupId
        return (this.client as any).subscribeToChanges?.(handler) ?? (() => {})
      } else {
        throw new Error('Invalid arguments for worker client subscribe')
      }
    }
  }
  
  // Delegate methods with strong typing
  async getState(groupId: string): Promise<GroupState> {
    return this.client.getState(brand.groupId(groupId))
  }
  
  async scheduleUpdate(contactId: string, content: unknown): Promise<void> {
    return this.client.scheduleUpdate(contactId, content)
  }
  
  async connect(fromId: string, toId: string, type: 'bidirectional' | 'directed' = 'bidirectional'): Promise<string> {
    // NetworkClient has connectContacts, others might have connect
    if ('connectContacts' in this.client) {
      const result = await (this.client as any).connectContacts(fromId, toId, type)
      return typeof result === 'string' ? result : ''
    } else {
      const result = await (this.client as any).connect(fromId, toId, type)
      return typeof result === 'string' ? result : ''
    }
  }
  
  async addContact(groupId: string, contact: Omit<Contact, 'id'>): Promise<string> {
    return this.client.addContact(groupId, contact)
  }
  
  async removeContact(contactId: string): Promise<void> {
    return this.client.removeContact(contactId)
  }
  
  // Wire methods - map to connect/disconnect
  async addWire(fromId: string, toId: string, type: 'bidirectional' | 'directed' = 'bidirectional'): Promise<string> {
    return this.connect(fromId, toId, type)
  }
  
  async removeWire(wireId: string): Promise<void> {
    if ('disconnectContacts' in this.client) {
      await (this.client as any).disconnectContacts(wireId)
    } else if ('disconnect' in this.client) {
      await this.client.disconnect(wireId)
    } else {
      throw new Error('Wire removal not supported by this client type')
    }
  }
  
  async addGroup(parentId: string, group: Omit<Group, 'id' | 'parentId' | 'contactIds' | 'wireIds' | 'subgroupIds' | 'boundaryContactIds'>): Promise<string> {
    return this.client.addGroup(parentId, group)
  }
  
  async removeGroup(groupId: string): Promise<void> {
    return this.client.removeGroup(groupId)
  }
  
  async registerGroup(group: Group): Promise<void> {
    return this.client.registerGroup(group)
  }
  
  async getContact(contactId: string): Promise<Contact | undefined> {
    return this.client.getContact(contactId)
  }
  
  // Methods that might not exist on all clients
  async applyRefactoring(refactoringType: string, params: any): Promise<any> {
    if ('applyRefactoring' in this.client) {
      return (this.client as any).applyRefactoring(refactoringType, params)
    }
    throw new Error('Refactoring not supported by this client type')
  }
  
  async exportState(groupId?: string): Promise<any> {
    if ('exportState' in this.client) {
      return (this.client as any).exportState(groupId)
    }
    throw new Error('Export not supported by this client type')
  }
  
  async importState(state: any): Promise<void> {
    if ('importState' in this.client) {
      return (this.client as any).importState(state)
    }
    throw new Error('Import not supported by this client type')
  }
  
  async terminate(): Promise<void> {
    if ('terminate' in this.client) {
      return (this.client as any).terminate()
    }
    if ('disconnect' in this.client) {
      return this.client.disconnect()
    }
  }
}