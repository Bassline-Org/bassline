/**
 * Persistence for Stream-based Runtime
 * 
 * Provides save/load functionality for groups and their descendants
 * Cleanly separates structure from data
 */

import { Bassline, ContactId } from './types'
import { Runtime } from './stream-runtime'
import { promises as fs } from 'fs'
import * as path from 'path'

/**
 * Exported group format - structure and data separated
 */
export interface ExportedGroup {
  structure: Bassline  // The network topology
  data: Array<[ContactId, any]>  // setValue actions for contacts
}

/**
 * Export a group and all its descendants
 */
export function exportGroup(runtime: Runtime, groupId: string): ExportedGroup {
  const structure: Bassline = {
    contacts: new Map(),
    wires: new Map(),
    groups: new Map()
  }
  
  const data: Array<[ContactId, any]> = []
  
  // Helper to recursively collect all descendants
  const collectGroup = (gId: string) => {
    const group = runtime.groups.get(gId)
    if (!group) return
    
    // Add group to structure (convert to ReifiedGroup format)
    structure.groups.set(gId, {
      parentId: group.parentId,
      contactIds: new Set(group.contacts.keys()),
      boundaryContactIds: group.getBoundaryContacts(),
      primitiveType: group.properties?.primitiveType,
      properties: group.properties
    })
    
    // Add group's contacts to structure and collect their values
    for (const [qualifiedContactId, contact] of group.contacts) {
      // Extract local contact ID from qualified ID
      // Format: "groupId:contactId" where contactId can contain colons  
      const groupPrefix = `${contact.groupId}:`
      const localContactId = qualifiedContactId.startsWith(groupPrefix) 
        ? qualifiedContactId.slice(groupPrefix.length)
        : qualifiedContactId
      
      // Add contact to structure (without content) using local ID
      structure.contacts.set(localContactId, {
        groupId: contact.groupId,
        properties: contact.properties
      })
      
      // Collect contact's value if it has one
      const value = contact.getValue()
      if (value !== undefined) {
        data.push([localContactId, value])
      }
    }
    
    // Recursively collect child groups
    for (const [childId, childGroup] of runtime.groups) {
      if (childGroup.parentId === gId) {
        collectGroup(childId)
      }
    }
  }
  
  // Start collection from the specified group
  collectGroup(groupId)
  
  // Collect all wires that connect contacts within our structure
  for (const [wireId, wire] of runtime.wires) {
    // Convert qualified IDs back to local IDs
    const fromContact = runtime.contacts.get(wire.from)
    const toContact = runtime.contacts.get(wire.to)
    if (fromContact && toContact) {
      const fromPrefix = `${fromContact.groupId}:`
      const toPrefix = `${toContact.groupId}:`
      const fromLocalId = wire.from.startsWith(fromPrefix) ? wire.from.slice(fromPrefix.length) : wire.from
      const toLocalId = wire.to.startsWith(toPrefix) ? wire.to.slice(toPrefix.length) : wire.to
    
      // Only include wires where both contacts are in our exported structure
      if (structure.contacts.has(fromLocalId) && structure.contacts.has(toLocalId)) {
        structure.wires.set(wireId, {
          fromId: fromLocalId,
          toId: toLocalId,
          properties: { bidirectional: wire.bidirectional }
        })
      }
    }
  }
  
  return { structure, data }
}

/**
 * Import a group into the runtime at the specified parent
 */
export function importGroup(
  runtime: Runtime, 
  exported: ExportedGroup, 
  parentId?: string
): void {
  const { structure, data } = exported
  
  // First pass: Create all groups
  for (const [groupId, group] of structure.groups) {
    // Adjust parent ID for root group if mounting under a parent
    const adjustedParentId = !group.parentId && parentId ? parentId : group.parentId
    
    runtime.createGroup(
      groupId,
      group.primitiveType,
      group.properties,
      adjustedParentId
    )
  }
  
  // Second pass: Create all contacts
  for (const [localContactId, contact] of structure.contacts) {
    runtime.createContact(
      localContactId,
      contact.groupId,
      contact.properties?.blendMode || 'merge',
      contact.properties
    )
  }
  
  // Third pass: Create all wires
  for (const [wireId, wire] of structure.wires) {
    if (!runtime.wires.has(wireId)) {
      // Find the groupIds for the from and to contacts
      const fromContact = structure.contacts.get(wire.fromId)
      const toContact = structure.contacts.get(wire.toId)
      
      if (fromContact && toContact && fromContact.groupId && toContact.groupId) {
        // Runtime internally uses qualified IDs, but we construct them here
        const qualifiedFromId = `${fromContact.groupId}:${wire.fromId}`
        const qualifiedToId = `${toContact.groupId}:${wire.toId}`
        
        runtime.createWire(
          wireId,
          qualifiedFromId,
          qualifiedToId,
          wire.properties?.bidirectional !== false
        )
      }
    }
  }
  
  // Fourth pass: Set all values
  for (const [localContactId, value] of data) {
    // Find the contact by local ID and get its group
    const contact = structure.contacts.get(localContactId)
    
    if (contact && contact.groupId) {
      runtime.setValue(contact.groupId, localContactId, value)
    }
  }
}

/**
 * Save exported group to a file
 */
export async function saveToFile(exported: ExportedGroup, filepath: string): Promise<void> {
  const json = stringify(exported)
  const dir = path.dirname(filepath)
  
  // Ensure directory exists
  await fs.mkdir(dir, { recursive: true })
  
  // Write file
  await fs.writeFile(filepath, json, 'utf8')
}

/**
 * Load exported group from a file
 */
export async function loadFromFile(filepath: string): Promise<ExportedGroup> {
  const json = await fs.readFile(filepath, 'utf8')
  return parse(json)
}

/**
 * Custom JSON replacer to handle Maps and Sets
 */
function jsonReplacer(_key: string, value: any): any {
  if (value instanceof Map) {
    return {
      _type: 'Map',
      entries: Array.from(value.entries())
    }
  }
  if (value instanceof Set) {
    return {
      _type: 'Set',
      values: Array.from(value)
    }
  }
  return value
}

/**
 * Export entire runtime (convenience function)
 */
export function exportRuntime(runtime: Runtime): ExportedGroup {
  // Collect all root groups
  const rootGroups: string[] = []
  for (const [groupId, group] of runtime.groups) {
    if (!group.parentId) {
      rootGroups.push(groupId)
    }
  }
  
  // If there's only one root, export it
  if (rootGroups.length === 1) {
    return exportGroup(runtime, rootGroups[0])
  }
  
  // Otherwise, export everything as a virtual root
  const structure: Bassline = {
    contacts: new Map(),
    wires: new Map(),
    groups: new Map()
  }
  
  // Convert runtime format to Bassline format
  for (const [qualifiedContactId, contact] of runtime.contacts) {
    // Extract local contact ID
    const groupPrefix = `${contact.groupId}:`
    const localContactId = qualifiedContactId.startsWith(groupPrefix) 
      ? qualifiedContactId.slice(groupPrefix.length)
      : qualifiedContactId
    
    structure.contacts.set(localContactId, {
      groupId: contact.groupId,
      properties: contact.properties
    })
  }
  
  for (const [wireId, wire] of runtime.wires) {
    // Extract local IDs from qualified IDs
    const fromContact = runtime.contacts.get(wire.from)
    const toContact = runtime.contacts.get(wire.to)
    if (fromContact && toContact) {
      const fromPrefix = `${fromContact.groupId}:`
      const toPrefix = `${toContact.groupId}:`
      const fromLocalId = wire.from.startsWith(fromPrefix) ? wire.from.slice(fromPrefix.length) : wire.from
      const toLocalId = wire.to.startsWith(toPrefix) ? wire.to.slice(toPrefix.length) : wire.to
    
      structure.wires.set(wireId, {
        fromId: fromLocalId,
        toId: toLocalId,
        properties: { bidirectional: wire.bidirectional }
      })
    }
  }
  
  for (const [groupId, group] of runtime.groups) {
    structure.groups.set(groupId, {
      parentId: group.parentId,
      contactIds: new Set(group.contacts.keys()),
      boundaryContactIds: group.getBoundaryContacts(),
      primitiveType: group.properties?.primitiveType,
      properties: group.properties
    })
  }
  
  const data: Array<[ContactId, any]> = []
  for (const [qualifiedContactId, contact] of runtime.contacts) {
    // Extract local contact ID
    const groupPrefix = `${contact.groupId}:`
    const localContactId = qualifiedContactId.startsWith(groupPrefix) 
      ? qualifiedContactId.slice(groupPrefix.length)
      : qualifiedContactId
    
    const value = contact.getValue()
    if (value !== undefined) {
      data.push([localContactId, value])
    }
  }
  
  return { structure, data }
}

/**
 * Stringify an exported group with proper Map/Set handling
 */
export function stringify(exported: ExportedGroup): string {
  return JSON.stringify(exported, jsonReplacer, 2)
}

/**
 * Parse a stringified exported group
 */
export function parse(json: string): ExportedGroup {
  const parsed = JSON.parse(json, (_key, value) => {
    if (value && typeof value === 'object') {
      if (value._type === 'Map' && Array.isArray(value.entries)) {
        return new Map(value.entries)
      }
      if (value._type === 'Set' && Array.isArray(value.values)) {
        return new Set(value.values)
      }
    }
    return value
  })
  
  // Ensure structure properties are Maps/Sets if they weren't properly parsed
  if (parsed.structure) {
    if (!parsed.structure.contacts || !(parsed.structure.contacts instanceof Map)) {
      parsed.structure.contacts = new Map()
    }
    if (!parsed.structure.wires || !(parsed.structure.wires instanceof Map)) {
      parsed.structure.wires = new Map()
    }
    if (!parsed.structure.groups || !(parsed.structure.groups instanceof Map)) {
      parsed.structure.groups = new Map()
    }
  }
  
  return parsed
}