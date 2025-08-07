// Inline Group refactoring operation
// This is a VIEW AGNOSTIC operation that only transforms the network state

import type { NetworkState, Contact, Wire, Group } from '../../types'
import type { InlineGroupParams, RefactoringResult, RefactoringChange } from '../types'
import { cloneNetworkState, generateId } from '../utils'

/**
 * Inline a group - the inverse of extract-to-group
 * 
 * This operation:
 * 1. Moves all contacts from the group to its parent
 * 2. Removes boundary contacts and their internal wires
 * 3. Rewires external connections to bypass boundaries
 * 4. Deletes the group
 */
export function inlineGroup(
  state: NetworkState,
  params: InlineGroupParams
): RefactoringResult {
  const { groupId } = params
  const changes: RefactoringChange[] = []
  
  // Clone the state for immutability
  const newState = cloneNetworkState(state)
  
  // Get the group to inline
  const groupState = newState.groups.get(groupId)
  if (!groupState) {
    throw new Error(`Group ${groupId} not found`)
  }
  
  const group = groupState.group
  
  // Get parent group
  if (!group.parentId) {
    throw new Error(`Cannot inline root group`)
  }
  
  const parentGroupState = newState.groups.get(group.parentId)
  if (!parentGroupState) {
    throw new Error(`Parent group ${group.parentId} not found`)
  }
  
  // Build a map of boundary contacts to their connected internal contacts
  const boundaryToInternalMap = new Map<string, string>()
  const internalToBoundaryMap = new Map<string, string>()
  
  // Find internal wires that connect boundaries to internal contacts
  groupState.wires.forEach(wire => {
    const fromContact = groupState.contacts.get(wire.fromId)
    const toContact = groupState.contacts.get(wire.toId)
    
    if (fromContact?.isBoundary && toContact && !toContact.isBoundary) {
      // Input boundary -> internal contact
      boundaryToInternalMap.set(wire.fromId, wire.toId)
      internalToBoundaryMap.set(wire.toId, wire.fromId)
    } else if (toContact?.isBoundary && fromContact && !fromContact.isBoundary) {
      // Internal contact -> output boundary
      boundaryToInternalMap.set(wire.toId, wire.fromId)
      internalToBoundaryMap.set(wire.fromId, wire.toId)
    }
  })
  
  // Move non-boundary contacts to parent group
  const movedContacts = new Map<string, Contact>()
  groupState.contacts.forEach((contact, contactId) => {
    if (!contact.isBoundary) {
      // Update contact's group reference
      contact.groupId = group.parentId!
      
      // Add to parent group
      parentGroupState.contacts.set(contactId, contact)
      parentGroupState.group.contactIds.push(contactId)
      
      movedContacts.set(contactId, contact)
      
      changes.push({
        type: 'contact-moved',
        data: { contactId, fromGroup: groupId, toGroup: group.parentId }
      })
    }
  })
  
  // Move internal wires (between non-boundary contacts) to parent
  const movedWires = new Map<string, Wire>()
  groupState.wires.forEach((wire, wireId) => {
    const fromIsBoundary = groupState.contacts.get(wire.fromId)?.isBoundary
    const toIsBoundary = groupState.contacts.get(wire.toId)?.isBoundary
    
    if (!fromIsBoundary && !toIsBoundary) {
      // Both endpoints are internal - move wire to parent
      wire.groupId = group.parentId!
      parentGroupState.wires.set(wireId, wire)
      parentGroupState.group.wireIds.push(wireId)
      movedWires.set(wireId, wire)
    }
  })
  
  // Fix external wires that connect to boundary contacts
  // We need to check all groups, not just the parent
  newState.groups.forEach((otherGroupState, otherGroupId) => {
    if (otherGroupId === groupId) return // Skip the group being inlined
    
    otherGroupState.wires.forEach(wire => {
      let updated = false
      
      // Check if wire connects to a boundary contact
      if (group.boundaryContactIds.includes(wire.fromId)) {
        // This wire comes from a boundary - redirect to internal contact
        const internalContactId = boundaryToInternalMap.get(wire.fromId)
        if (internalContactId) {
          wire.fromId = internalContactId
          updated = true
        }
      }
      
      if (group.boundaryContactIds.includes(wire.toId)) {
        // This wire goes to a boundary - redirect to internal contact
        const internalContactId = boundaryToInternalMap.get(wire.toId)
        if (internalContactId) {
          wire.toId = internalContactId
          updated = true
        }
      }
      
      if (updated) {
        changes.push({
          type: 'wire-updated',
          data: { wireId: wire.id, wire }
        })
      }
    })
  })
  
  // Remove the group from parent's subgroups
  parentGroupState.group.subgroupIds = parentGroupState.group.subgroupIds.filter(
    id => id !== groupId
  )
  
  // Delete the group
  newState.groups.delete(groupId)
  
  changes.push({
    type: 'group-deleted',
    data: { groupId, parentId: group.parentId }
  })
  
  return { state: newState, changes }
}