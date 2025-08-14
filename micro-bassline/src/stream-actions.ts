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
  apply: (rt) => rt.createContact(contactId, groupId, properties?.blendMode || 'merge', properties)
})

export const deleteContact = (contactId: ContactId): Action => ({
  type: 'deleteContact',
  data: { contactId },
  apply: (rt) => {
    const contact = rt['contacts'].get(contactId)
    if (!contact) return
    
    for (const group of rt['groups'].values()) {
      group.contacts.delete(contactId)
      group.boundaryContacts.delete(contactId)
    }
    rt['contacts'].delete(contactId)
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
  apply: (rt) => rt.createWire(wireId, fromId, toId, bidirectional)
})

export const deleteWire = (wireId: WireId): Action => ({
  type: 'deleteWire',
  data: { wireId },
  apply: (rt) => rt['wires'].delete(wireId)
})

export const createGroup = (
  groupId: GroupId,
  parentId?: GroupId,
  properties?: Properties
): Action => ({
  type: 'createGroup',
  data: { groupId, parentId, properties },
  apply: (rt) => rt.createGroup(groupId, properties?.primitiveType, properties)
})

export const deleteGroup = (groupId: GroupId): Action => ({
  type: 'deleteGroup',
  data: { groupId },
  apply: (rt) => {
    const group = rt['groups'].get(groupId)
    if (!group) return
    
    for (const contactId of group.contacts.keys()) {
      deleteContact(contactId).apply(rt)
    }
    rt['groups'].delete(groupId)
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