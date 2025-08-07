/**
 * Dynamic bassline features - attributes and topology from contacts
 */

import type { Group, Contact, GroupState } from '../types'
import type { BasslineAttributes, Bassline } from './types'
import type { PropagationNetworkScheduler } from '../scheduler'

/**
 * Check if a group has dynamic attributes enabled
 */
export function hasDynamicAttributes(group: Group): boolean {
  const dynamicConfig = group.attributes?.['bassline.dynamic-attributes']
  return typeof dynamicConfig === 'object' && 
         dynamicConfig !== null && 
         'enabled' in dynamicConfig && 
         dynamicConfig.enabled === true
}

/**
 * Get the contact ID for dynamic attributes
 */
export function getDynamicAttributesContactId(group: Group): string | undefined {
  const dynamicConfig = group.attributes?.['bassline.dynamic-attributes']
  if (typeof dynamicConfig === 'object' && 
      dynamicConfig !== null && 
      'contact' in dynamicConfig) {
    return dynamicConfig.contact as string
  }
  return undefined
}

/**
 * Apply dynamic attributes from a contact's content
 */
export async function applyDynamicAttributes(
  group: Group,
  state: GroupState,
  scheduler: PropagationNetworkScheduler
): Promise<BasslineAttributes | undefined> {
  if (!hasDynamicAttributes(group)) {
    return undefined
  }
  
  const contactId = getDynamicAttributesContactId(group)
  if (!contactId) {
    console.warn('Dynamic attributes enabled but no contact specified')
    return undefined
  }
  
  // Find the contact in the group's boundary or regular contacts
  let contact: Contact | undefined
  
  // Check boundary contacts first
  if (group.boundaryContactIds.includes(contactId)) {
    contact = state.contacts.get(contactId)
  }
  
  // Check regular contacts if not found
  if (!contact && group.contactIds.includes(contactId)) {
    contact = state.contacts.get(contactId)
  }
  
  if (!contact) {
    console.warn(`Dynamic attributes contact ${contactId} not found`)
    return undefined
  }
  
  // The contact's content should be a BasslineAttributes object
  const content = contact.content
  if (!content || typeof content !== 'object') {
    return undefined
  }
  
  // Validate it's a proper attributes object
  const attributes = content as BasslineAttributes
  
  // Merge with existing attributes (dynamic overrides static)
  const merged: BasslineAttributes = {
    ...group.attributes,
    ...attributes
  }
  
  return merged
}

/**
 * Check if a group has dynamic topology enabled
 */
export function hasDynamicTopology(group: Group): boolean {
  const dynamicConfig = group.attributes?.['bassline.dynamic-topology']
  return typeof dynamicConfig === 'object' && 
         dynamicConfig !== null && 
         'enabled' in dynamicConfig && 
         dynamicConfig.enabled === true
}

/**
 * Get the contact ID for dynamic topology
 */
export function getDynamicTopologyContactId(group: Group): string | undefined {
  const dynamicConfig = group.attributes?.['bassline.dynamic-topology']
  if (typeof dynamicConfig === 'object' && 
      dynamicConfig !== null && 
      'schemaContact' in dynamicConfig) {
    return dynamicConfig.schemaContact as string
  }
  return undefined
}

/**
 * Build topology from a contact's content
 */
export async function buildDynamicTopology(
  group: Group,
  state: GroupState,
  scheduler: PropagationNetworkScheduler
): Promise<Bassline | undefined> {
  if (!hasDynamicTopology(group)) {
    return undefined
  }
  
  const contactId = getDynamicTopologyContactId(group)
  if (!contactId) {
    console.warn('Dynamic topology enabled but no schema contact specified')
    return undefined
  }
  
  // Find the contact
  let contact: Contact | undefined
  
  // Check boundary contacts first
  if (group.boundaryContactIds.includes(contactId)) {
    contact = state.contacts.get(contactId)
  }
  
  // Check regular contacts if not found
  if (!contact && group.contactIds.includes(contactId)) {
    contact = state.contacts.get(contactId)
  }
  
  if (!contact) {
    console.warn(`Dynamic topology contact ${contactId} not found`)
    return undefined
  }
  
  // The contact's content should be a Bassline or topology definition
  const content = contact.content
  if (!content || typeof content !== 'object') {
    return undefined
  }
  
  // Check if it's a full bassline
  if ('name' in content || 'build' in content) {
    return content as Bassline
  }
  
  // Otherwise treat it as just topology
  return {
    name: `${group.name || group.id}-dynamic`,
    build: {
      topology: content as any
    }
  }
}

/**
 * Monitor a group for dynamic changes
 */
export function createDynamicMonitor(
  groupId: string,
  scheduler: PropagationNetworkScheduler
) {
  let lastAttributesContent: any = null
  let lastTopologyContent: any = null
  
  // Subscribe to changes
  const unsubscribe = scheduler.subscribe(async (changes) => {
    // Get current group state
    const state = await scheduler.getState(groupId)
    if (!state) return
    
    const group = state.group
    
    // Check for dynamic attributes changes
    if (hasDynamicAttributes(group)) {
      const contactId = getDynamicAttributesContactId(group)
      if (contactId) {
        const change = changes.find(c => c.contactId === contactId)
        if (change) {
          const contact = state.contacts.get(contactId)
          if (contact && contact.content !== lastAttributesContent) {
            lastAttributesContent = contact.content
            
            // Apply new attributes
            const newAttributes = await applyDynamicAttributes(group, state, scheduler)
            if (newAttributes) {
              // Update group with new attributes
              // This would need to be implemented in the scheduler
              console.log('Dynamic attributes updated:', newAttributes)
            }
          }
        }
      }
    }
    
    // Check for dynamic topology changes
    if (hasDynamicTopology(group)) {
      const contactId = getDynamicTopologyContactId(group)
      if (contactId) {
        const change = changes.find(c => c.contactId === contactId)
        if (change) {
          const contact = state.contacts.get(contactId)
          if (contact && contact.content !== lastTopologyContent) {
            lastTopologyContent = contact.content
            
            // Build new topology
            const newTopology = await buildDynamicTopology(group, state, scheduler)
            if (newTopology) {
              // Rebuild the group with new topology
              // This would need to be implemented
              console.log('Dynamic topology updated:', newTopology)
            }
          }
        }
      }
    }
  })
  
  return unsubscribe
}