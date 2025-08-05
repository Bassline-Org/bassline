import type { 
  PropagationNetworkScheduler, 
  GroupState, 
  NetworkState,
  Group,
  Contact,
  Wire,
  Change,
  PropagationTask
} from '../types'
import { propagateContent } from '../propagation'

export function createImmediateScheduler(): PropagationNetworkScheduler {
  // Internal state
  const state: NetworkState = {
    groups: new Map(),
    currentGroupId: '',
    rootGroupId: ''
  }
  
  const subscribers = new Set<(changes: Change[]) => void>()
  
  // Helper to notify subscribers
  function notify(changes: Change[]) {
    subscribers.forEach(callback => callback(changes))
  }
  
  // Helper to find a contact anywhere in the network
  function findContact(contactId: string): Contact | undefined {
    for (const groupState of state.groups.values()) {
      const contact = groupState.contacts.get(contactId)
      if (contact) return contact
    }
    return undefined
  }
  
  // Helper to find which group contains a contact
  function findGroupForContact(contactId: string): string | undefined {
    for (const [groupId, groupState] of state.groups) {
      if (groupState.contacts.has(contactId)) {
        return groupId
      }
    }
    return undefined
  }
  
  return {
    async registerGroup(group) {
      const groupState: GroupState = {
        group,
        contacts: new Map(),
        wires: new Map()
      }
      state.groups.set(group.id, groupState)
      
      // Set root group if this is the first
      if (!state.rootGroupId) {
        state.rootGroupId = group.id
        state.currentGroupId = group.id
      }
      
      notify([{
        type: 'group-added',
        data: group,
        timestamp: Date.now()
      }])
    },
    
    async scheduleUpdate(contactId, content) {
      const contact = findContact(contactId)
      if (!contact) {
        throw new Error(`Contact ${contactId} not found`)
      }
      
      // Run propagation immediately
      const result = await propagateContent(state, contactId, content)
      
      // Apply changes to state
      for (const change of result.changes) {
        const groupId = findGroupForContact(change.contactId)
        if (groupId) {
          const groupState = state.groups.get(groupId)
          if (groupState) {
            const contact = groupState.contacts.get(change.contactId)
            if (contact) {
              groupState.contacts.set(change.contactId, {
                ...contact,
                ...change.updates
              })
            }
          }
        }
      }
      
      // Notify subscribers
      const changes: Change[] = result.changes.map(change => ({
        type: 'contact-updated',
        data: change,
        timestamp: Date.now()
      }))
      
      notify(changes)
    },
    
    async schedulePropagation(fromContactId, toContactId, content) {
      // This is handled by the propagation algorithm when we create wires
      // For now, just schedule an update on the target
      await this.scheduleUpdate(toContactId, content)
    },
    
    async connect(fromId, toId, type = 'bidirectional') {
      const fromContact = findContact(fromId)
      const toContact = findContact(toId)
      
      if (!fromContact || !toContact) {
        throw new Error('Cannot connect: one or both contacts not found')
      }
      
      // Ensure both contacts are in the same group or one is a boundary contact
      const fromGroup = findGroupForContact(fromId)
      const toGroup = findGroupForContact(toId)
      
      if (fromGroup !== toGroup && !fromContact.isBoundary && !toContact.isBoundary) {
        throw new Error('Cannot connect contacts from different groups unless one is a boundary contact')
      }
      
      const groupId = fromGroup || toGroup || ''
      const wireId = crypto.randomUUID()
      const wire: Wire = {
        id: wireId,
        groupId,
        fromId,
        toId,
        type
      }
      
      const groupState = state.groups.get(groupId)
      if (groupState) {
        groupState.wires.set(wireId, wire)
        groupState.group.wireIds.push(wireId)
      }
      
      // Propagate content if source has content
      if (fromContact.content !== undefined) {
        await this.scheduleUpdate(toId, fromContact.content)
      }
      
      // For bidirectional, also propagate from target to source
      if (type === 'bidirectional' && toContact.content !== undefined) {
        await this.scheduleUpdate(fromId, toContact.content)
      }
      
      notify([{
        type: 'wire-added',
        data: wire,
        timestamp: Date.now()
      }])
      
      return wireId
    },
    
    async disconnect(wireId) {
      for (const groupState of state.groups.values()) {
        if (groupState.wires.has(wireId)) {
          groupState.wires.delete(wireId)
          groupState.group.wireIds = groupState.group.wireIds.filter(id => id !== wireId)
          
          notify([{
            type: 'wire-removed',
            data: { wireId },
            timestamp: Date.now()
          }])
          
          return
        }
      }
      throw new Error(`Wire ${wireId} not found`)
    },
    
    async addContact(groupId, contactData) {
      const groupState = state.groups.get(groupId)
      if (!groupState) {
        throw new Error(`Group ${groupId} not found`)
      }
      
      const contactId = crypto.randomUUID()
      const contact: Contact = {
        ...contactData,
        id: contactId,
        groupId
      }
      
      groupState.contacts.set(contactId, contact)
      groupState.group.contactIds.push(contactId)
      
      if (contact.isBoundary) {
        groupState.group.boundaryContactIds.push(contactId)
      }
      
      notify([{
        type: 'contact-updated',
        data: { contactId, updates: contact },
        timestamp: Date.now()
      }])
      
      return contactId
    },
    
    async removeContact(contactId) {
      const groupId = findGroupForContact(contactId)
      if (!groupId) {
        throw new Error(`Contact ${contactId} not found`)
      }
      
      const groupState = state.groups.get(groupId)
      if (!groupState) return
      
      // Remove contact
      groupState.contacts.delete(contactId)
      groupState.group.contactIds = groupState.group.contactIds.filter(id => id !== contactId)
      groupState.group.boundaryContactIds = groupState.group.boundaryContactIds.filter(id => id !== contactId)
      
      // Remove any wires connected to this contact
      const wiresToRemove: string[] = []
      for (const [wireId, wire] of groupState.wires) {
        if (wire.fromId === contactId || wire.toId === contactId) {
          wiresToRemove.push(wireId)
        }
      }
      
      for (const wireId of wiresToRemove) {
        await this.disconnect(wireId)
      }
    },
    
    async addGroup(parentGroupId, groupData) {
      const parentState = state.groups.get(parentGroupId)
      if (!parentState) {
        throw new Error(`Parent group ${parentGroupId} not found`)
      }
      
      const groupId = crypto.randomUUID()
      const group: Group = {
        ...groupData,
        id: groupId,
        parentId: parentGroupId,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      }
      
      await this.registerGroup(group)
      
      // Add to parent's subgroups
      parentState.group.subgroupIds.push(groupId)
      
      return groupId
    },
    
    async removeGroup(groupId) {
      const groupState = state.groups.get(groupId)
      if (!groupState) {
        throw new Error(`Group ${groupId} not found`)
      }
      
      // Remove all contacts in the group
      for (const contactId of [...groupState.group.contactIds]) {
        await this.removeContact(contactId)
      }
      
      // Remove all subgroups
      for (const subgroupId of [...groupState.group.subgroupIds]) {
        await this.removeGroup(subgroupId)
      }
      
      // Remove from parent's subgroups
      if (groupState.group.parentId) {
        const parentState = state.groups.get(groupState.group.parentId)
        if (parentState) {
          parentState.group.subgroupIds = parentState.group.subgroupIds.filter(id => id !== groupId)
        }
      }
      
      // Finally remove the group
      state.groups.delete(groupId)
      
      notify([{
        type: 'group-removed',
        data: { groupId },
        timestamp: Date.now()
      }])
    },
    
    async getState(groupId) {
      const groupState = state.groups.get(groupId)
      if (!groupState) {
        throw new Error(`Group ${groupId} not found`)
      }
      return groupState
    },
    
    async getContact(contactId) {
      return findContact(contactId)
    },
    
    async getWire(wireId) {
      for (const groupState of state.groups.values()) {
        const wire = groupState.wires.get(wireId)
        if (wire) return wire
      }
      return undefined
    },
    
    subscribe(callback) {
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    }
  }
}