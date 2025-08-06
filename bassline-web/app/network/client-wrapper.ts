import type { NetworkClient } from '~/propagation-core-v2/worker/network-client'
import type { RemoteNetworkClient } from './remote-client'
import type { Change } from '~/propagation-core-v2/types'

/**
 * Wrapper that provides a consistent subscribe interface for both client types
 */
export class ClientWrapper {
  private client: NetworkClient | RemoteNetworkClient
  private isRemote: boolean
  
  constructor(client: NetworkClient | RemoteNetworkClient) {
    this.client = client
    this.isRemote = 'serverUrl' in client
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
      // Remote client: subscribe(groupId, handler)
      if (typeof handlerOrGroupId === 'string' && handler) {
        return (this.client as RemoteNetworkClient).subscribe(handlerOrGroupId, handler)
      } else if (typeof handlerOrGroupId === 'function') {
        // No groupId provided, subscribe to root
        console.warn('[ClientWrapper] Remote client subscribe called without groupId, defaulting to root')
        return (this.client as RemoteNetworkClient).subscribe('root', handlerOrGroupId)
      } else {
        throw new Error('Invalid arguments for remote client subscribe')
      }
    } else {
      // Worker client: subscribe(handler)
      if (typeof handlerOrGroupId === 'function') {
        return this.client.subscribe(handlerOrGroupId)
      } else if (typeof handler === 'function') {
        // GroupId provided but not needed for worker client  
        // Just pass the handler, ignore the groupId
        return this.client.subscribe(handler)
      } else {
        throw new Error('Invalid arguments for worker client subscribe')
      }
    }
  }
  
  // Delegate all other methods to the underlying client
  getState(groupId: string) {
    return this.client.getState(groupId)
  }
  
  scheduleUpdate(contactId: string, content: any) {
    return this.client.scheduleUpdate(contactId, content)
  }
  
  connect(fromId: string, toId: string, type: 'bidirectional' | 'directed' = 'bidirectional') {
    return this.client.connect(fromId, toId, type)
  }
  
  addContact(groupId: string, contact: any) {
    return this.client.addContact(groupId, contact)
  }
  
  removeContact(contactId: string) {
    return this.client.removeContact(contactId)
  }
  
  addWire(fromId: string, toId: string, type: 'bidirectional' | 'directed' = 'bidirectional') {
    return this.client.addWire(fromId, toId, type)
  }
  
  removeWire(wireId: string) {
    return this.client.removeWire(wireId)
  }
  
  addGroup(parentId: string, group: any) {
    return this.client.addGroup(parentId, group)
  }
  
  removeGroup(groupId: string) {
    return this.client.removeGroup(groupId)
  }
  
  registerGroup(group: any) {
    return this.client.registerGroup(group)
  }
  
  applyRefactoring(refactoringType: string, params: any) {
    return this.client.applyRefactoring(refactoringType, params)
  }
  
  getContact(contactId: string) {
    return this.client.getContact(contactId)
  }
  
  exportState(groupId?: string) {
    return this.client.exportState(groupId)
  }
  
  importState(state: any) {
    return this.client.importState(state)
  }
  
  terminate() {
    return this.client.terminate()
  }
}