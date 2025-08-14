/**
 * Stream Actions: Functional approach with interfaces
 * 
 * Much more concise than classes!
 */

import { Runtime } from './stream-runtime'
import { ContactId, GroupId, WireId, Properties } from './types'

/**
 * Action interface - all actions conform to this
 */
export interface Action<T = any> {
  type: string
  data: T
  apply(runtime: Runtime): void
}

/**
 * Action factory functions - much more concise than classes
 */

export const setValue = (contactId: ContactId, value: any): Action => ({
  type: 'setValue',
  data: { contactId, value },
  apply: (rt) => rt.setValue(contactId, value)
})

export const createContact = (
  contactId: ContactId,
  groupId?: GroupId,
  properties?: Properties
): Action => ({
  type: 'createContact',
  data: { contactId, groupId, properties },
  apply: (rt) => {
    const contact = rt.createContact(contactId, groupId, properties?.blendMode || 'merge', properties)
    
    // If this contact is in a child group, update parent's structure
    if (groupId) {
      const group = rt.groups.get(groupId)
      if (group?.parentId) {
        // Update parent's structure contact
        rt.updateStructureContact(group.parentId)
      }
    }
    
    return contact
  }
})

export const deleteContact = (contactId: ContactId): Action => ({
  type: 'deleteContact',
  data: { contactId },
  apply: (rt) => {
    const contact = rt['contacts'].get(contactId)
    if (!contact) return
    
    // Track which parent groups need structure updates
    const parentsToUpdate = new Set<string>()
    
    for (const group of rt['groups'].values()) {
      if (group.contacts.has(contactId)) {
        group.contacts.delete(contactId)
        
        // If this group has a parent, mark it for structure update
        if (group.parentId) {
          parentsToUpdate.add(group.parentId)
        }
      }
    }
    
    rt['contacts'].delete(contactId)
    
    // Update all affected parent structures
    for (const parentId of parentsToUpdate) {
      rt.updateStructureContact(parentId)
    }
  }
})

export const createWire = (
  wireId: WireId,
  fromId: ContactId,
  toId: ContactId,
  bidirectional = true
): Action => ({
  type: 'createWire',
  data: { wireId, fromId, toId, bidirectional },
  apply: (rt) => {
    rt.createWire(wireId, fromId, toId, bidirectional)
    
    // Update structure if wire connects children of same parent
    const fromContact = rt.contacts.get(fromId)
    const toContact = rt.contacts.get(toId)
    if (fromContact?.groupId && toContact?.groupId) {
      const fromGroup = rt.groups.get(fromContact.groupId)
      const toGroup = rt.groups.get(toContact.groupId)
      
      // If both contacts are in child groups of the same parent
      if (fromGroup?.parentId && fromGroup.parentId === toGroup?.parentId) {
        rt.updateStructureContact(fromGroup.parentId)
      }
    }
  }
})

export const deleteWire = (wireId: WireId): Action => ({
  type: 'deleteWire',
  data: { wireId },
  apply: (rt) => {
    const wire = rt['wires'].get(wireId)
    if (!wire) return
    
    rt['wires'].delete(wireId)
    
    // Update structure if wire was between children
    const fromContact = rt.contacts.get(wire.from)
    const toContact = rt.contacts.get(wire.to)
    if (fromContact?.groupId && toContact?.groupId) {
      const fromGroup = rt.groups.get(fromContact.groupId)
      const toGroup = rt.groups.get(toContact.groupId)
      
      if (fromGroup?.parentId && fromGroup.parentId === toGroup?.parentId) {
        rt.updateStructureContact(fromGroup.parentId)
      }
    }
  }
})

export const createGroup = (
  groupId: GroupId,
  parentId?: GroupId,
  properties?: Properties
): Action => ({
  type: 'createGroup',
  data: { groupId, parentId, properties },
  apply: (rt) => rt.createGroup(groupId, properties?.primitiveType, properties, parentId)
})

export const deleteGroup = (groupId: GroupId): Action => ({
  type: 'deleteGroup',
  data: { groupId },
  apply: (rt) => {
    const group = rt['groups'].get(groupId)
    if (!group) return
    
    const parentId = group.parentId
    
    for (const contactId of group.contacts.keys()) {
      deleteContact(contactId).apply(rt)
    }
    rt['groups'].delete(groupId)
    
    // Update parent's structure contact if this was a child
    if (parentId) {
      rt.updateStructureContact(parentId)
    }
  }
})

export const updateProperties = (entityId: string, properties: Properties): Action => ({
  type: 'updateProperties',
  data: { entityId, properties },
  apply: (rt) => {
    const contact = rt['contacts'].get(entityId)
    if (contact) {
      Object.assign(contact.properties, properties)
      return
    }
    
    const group = rt['groups'].get(entityId)
    if (group) {
      // Handle MGP opt-in changes
      if ('expose-structure' in properties) {
        properties['expose-structure']
          ? rt['createMGPStructureContact'](entityId)
          : rt['contacts'].delete(`${entityId}:children:structure`)
      }
      
      if ('expose-dynamics' in properties) {
        properties['expose-dynamics']
          ? rt['createMGPDynamicsContact'](entityId)
          : rt['contacts'].delete(`${entityId}:children:dynamics`)
      }
      
      if ('allow-meta-mutation' in properties) {
        const shouldCreate = properties['allow-meta-mutation'] && !properties['distributed-mode']
        shouldCreate
          ? rt['createMGPActionsContact'](entityId)
          : rt['contacts'].delete(`${entityId}:children:actions`)
      }
    }
  }
})

/**
 * Convert old array format to action
 */
export const fromArray = (arr: any[]): Action => {
  const [type, ...args] = arr
  
  switch (type) {
    case 'setValue': return setValue(args[0], args[1])
    case 'createContact': return createContact(args[0], args[1], args[2])
    case 'deleteContact': return deleteContact(args[0])
    case 'createWire': return createWire(args[0], args[1], args[2], args[3]?.bidirectional !== false)
    case 'deleteWire': return deleteWire(args[0])
    case 'createGroup': return createGroup(args[0], args[1], args[2])
    case 'deleteGroup': return deleteGroup(args[0])
    case 'updateProperties': return updateProperties(args[0], args[1])
    default: throw new Error(`Unknown action type: ${type}`)
  }
}

/**
 * Apply multiple actions
 */
export const applyAll = (runtime: Runtime, actions: Action[]): void => {
  for (const action of actions) {
    action.apply(runtime)
  }
}