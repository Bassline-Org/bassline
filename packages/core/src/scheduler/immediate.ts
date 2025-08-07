import type { 
  PropagationNetworkScheduler, 
  GroupState, 
  NetworkState,
  Group,
  Contact,
  Wire,
  Change,
  PropagationTask,
  ContactId,
  GroupId,
  WireId
} from '../types'
import { brand } from '../types'
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
      // Check if group already exists
      if (state.groups.has(group.id)) {
        console.log(`[Scheduler] Group ${group.id} already exists, skipping registration`)
        return
      }
      
      const groupState: GroupState = {
        group,
        contacts: new Map(),
        wires: new Map()
      }
      state.groups.set(group.id, groupState)
      
      // If this is a primitive gadget, create boundary contacts
      if (group.primitive) {
        const primitive = group.primitive
        console.log(`[Scheduler] Creating boundary contacts for primitive gadget ${primitive.id}`)
        
        // Create input boundary contacts
        for (const inputName of primitive.inputs) {
          const cId = brand.contactId(crypto.randomUUID())
          const contact: Contact = {
            id: cId,
            content: undefined,
            blendMode: 'accept-last',
            groupId: group.id,
            isBoundary: true,
            boundaryDirection: 'input',
            name: inputName
          }
          groupState.contacts.set(cId, contact)
          group.contactIds.push(cId)
          group.boundaryContactIds.push(cId)
          
          console.log(`[Scheduler] Created input boundary contact ${inputName} (${cId})`)
        }
        
        // Create output boundary contacts
        for (const outputName of primitive.outputs) {
          const cId = brand.contactId(crypto.randomUUID())
          const contact: Contact = {
            id: cId,
            content: undefined,
            blendMode: 'accept-last',
            groupId: group.id,
            isBoundary: true,
            boundaryDirection: 'output',
            name: outputName
          }
          groupState.contacts.set(cId, contact)
          group.contactIds.push(cId)
          group.boundaryContactIds.push(cId)
          
          console.log(`[Scheduler] Created output boundary contact ${outputName} (${cId})`)
        }
      }
      
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
      const changes: Change[] = result.changes.map(change => {
        const changeGroupId = findGroupForContact(change.contactId)
        return {
          type: 'contact-updated',
          data: { ...change, groupId: changeGroupId },
          timestamp: Date.now()
        }
      })
      
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
      
      const gId = brand.groupId(fromGroup || toGroup || '')
      const wId = brand.wireId(crypto.randomUUID())
      const wire: Wire = {
        id: wId,
        groupId: gId,
        fromId: brand.contactId(fromId),
        toId: brand.contactId(toId),
        type
      }
      
      const groupState = state.groups.get(gId)
      if (groupState) {
        groupState.wires.set(wId, wire)
        groupState.group.wireIds.push(wId)
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
        data: { ...wire, groupId: gId },
        timestamp: Date.now()
      }])
      
      return wId
    },
    
    async disconnect(wireId) {
      for (const [groupId, groupState] of state.groups) {
        if (groupState.wires.has(wireId)) {
          groupState.wires.delete(wireId)
          groupState.group.wireIds = groupState.group.wireIds.filter(id => id !== wireId)
          
          notify([{
            type: 'wire-removed',
            data: { wireId, groupId },
            timestamp: Date.now()
          }])
          
          return
        }
      }
      throw new Error(`Wire ${wireId} not found`)
    },
    
    async addContact(groupIdStr, contactData) {
      const gId = brand.groupId(groupIdStr)
      const groupState = state.groups.get(gId)
      if (!groupState) {
        throw new Error(`Group ${groupIdStr} not found`)
      }
      
      const cId = brand.contactId(crypto.randomUUID())
      const contact: Contact = {
        ...contactData,
        id: cId,
        groupId: gId
      }
      
      groupState.contacts.set(cId, contact)
      groupState.group.contactIds.push(cId)
      
      if (contact.isBoundary) {
        groupState.group.boundaryContactIds.push(cId)
      }
      
      notify([{
        type: 'contact-added',
        data: { ...contact, groupId: gId },
        timestamp: Date.now()
      }])
      
      return cId
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
      
      // Notify about the removal
      notify([{
        type: 'contact-removed',
        data: { contactId, groupId },
        timestamp: Date.now()
      }])
    },
    
    async addGroup(parentGroupIdStr, groupData) {
      const parentGId = brand.groupId(parentGroupIdStr)
      const parentState = state.groups.get(parentGId)
      if (!parentState) {
        throw new Error(`Parent group ${parentGroupIdStr} not found`)
      }
      
      const gId = brand.groupId(crypto.randomUUID())
      const group: Group = {
        ...groupData,
        id: gId,
        parentId: parentGId,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      }
      
      await this.registerGroup(group)
      
      // Add to parent's subgroups
      parentState.group.subgroupIds.push(gId)
      
      // Notify about parent group update
      notify([{
        type: 'group-updated',
        data: { groupId: parentGId, group: parentState.group },
        timestamp: Date.now()
      }])
      
      return gId
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
    },
    
    // Export the entire network state
    async exportState(): Promise<NetworkState> {
      // Deep clone to prevent external mutations
      const exportedGroups = new Map()
      
      state.groups.forEach((groupState, groupId) => {
        const group = { ...groupState.group }
        const contacts = new Map()
        const wires = new Map()
        
        groupState.contacts.forEach((contact, contactId) => {
          contacts.set(contactId, { ...contact })
        })
        
        groupState.wires.forEach((wire, wireId) => {
          wires.set(wireId, { ...wire })
        })
        
        exportedGroups.set(groupId, { group, contacts, wires })
      })
      
      return {
        groups: exportedGroups,
        currentGroupId: state.currentGroupId,
        rootGroupId: state.rootGroupId
      }
    },
    
    // Import a complete network state
    async importState(newState: NetworkState): Promise<void> {
      // Clear existing state
      state.groups.clear()
      
      // Import new state
      newState.groups.forEach((groupState, groupId) => {
        const group = { ...groupState.group }
        const contacts = new Map()
        const wires = new Map()
        
        groupState.contacts.forEach((contact, contactId) => {
          contacts.set(contactId, { ...contact })
        })
        
        groupState.wires.forEach((wire, wireId) => {
          wires.set(wireId, { ...wire })
        })
        
        state.groups.set(groupId, { group, contacts, wires })
      })
      
      state.currentGroupId = newState.currentGroupId
      state.rootGroupId = newState.rootGroupId
      
      // Notify all subscribers about the state change
      notify([{
        type: 'group-updated',
        data: { groupId: state.rootGroupId, state: 'imported' },
        timestamp: Date.now()
      }])
    }
  }
}