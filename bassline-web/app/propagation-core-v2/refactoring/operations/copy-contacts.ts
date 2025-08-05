// Copy Contacts refactoring operation
// This is a VIEW AGNOSTIC operation that only transforms the network state

import type { NetworkState, Contact, Wire } from '../../types'
import type { CopyContactsParams, RefactoringResult, RefactoringChange } from '../types'
import { cloneNetworkState, generateId } from '../utils'

/**
 * Copy contacts to a target group
 * 
 * This operation:
 * 1. Creates copies of selected contacts in the target group
 * 2. Optionally copies wires between the selected contacts
 * 3. Maintains the same content and blend modes
 * 4. Does NOT copy external connections
 */
export function copyContacts(
  state: NetworkState,
  params: CopyContactsParams
): RefactoringResult {
  const { contactIds, targetGroupId, includeWires = true } = params
  const changes: RefactoringChange[] = []
  
  // Clone the state for immutability
  const newState = cloneNetworkState(state)
  
  // Verify target group exists
  const targetGroupState = newState.groups.get(targetGroupId)
  if (!targetGroupState) {
    throw new Error(`Target group ${targetGroupId} not found`)
  }
  
  // Map old contact IDs to new contact IDs
  const contactIdMap = new Map<string, string>()
  
  // Copy each contact
  contactIds.forEach(originalContactId => {
    // Find the original contact
    let originalContact: Contact | undefined
    let sourceGroupId: string | undefined
    
    for (const [groupId, groupState] of newState.groups) {
      const contact = groupState.contacts.get(originalContactId)
      if (contact) {
        originalContact = contact
        sourceGroupId = groupId
        break
      }
    }
    
    if (!originalContact || !sourceGroupId) {
      console.warn(`Contact ${originalContactId} not found, skipping`)
      return
    }
    
    // Don't copy boundary contacts
    if (originalContact.isBoundary) {
      console.warn(`Cannot copy boundary contact ${originalContactId}, skipping`)
      return
    }
    
    // Create the new contact
    const newContactId = generateId()
    const newContact: Contact = {
      ...originalContact,
      id: newContactId,
      groupId: targetGroupId
    }
    
    // Add to target group
    targetGroupState.contacts.set(newContactId, newContact)
    targetGroupState.group.contactIds.push(newContactId)
    
    // Track the mapping
    contactIdMap.set(originalContactId, newContactId)
    
    changes.push({
      type: 'contact-created',
      data: { 
        contactId: newContactId, 
        groupId: targetGroupId,
        copiedFrom: originalContactId
      }
    })
  })
  
  // Copy wires between selected contacts if requested
  if (includeWires) {
    const copiedWireIds = new Set<string>()
    
    // Look through all groups for wires
    for (const [groupId, groupState] of newState.groups) {
      groupState.wires.forEach((wire, wireId) => {
        // Check if both endpoints are in our copied contacts
        const newFromId = contactIdMap.get(wire.fromId)
        const newToId = contactIdMap.get(wire.toId)
        
        if (newFromId && newToId) {
          // Both endpoints were copied - create a new wire
          const newWireId = generateId()
          const newWire: Wire = {
            id: newWireId,
            groupId: targetGroupId,
            fromId: newFromId,
            toId: newToId,
            type: wire.type
          }
          
          // Add to target group
          targetGroupState.wires.set(newWireId, newWire)
          targetGroupState.group.wireIds.push(newWireId)
          copiedWireIds.add(newWireId)
          
          changes.push({
            type: 'wire-created',
            data: { 
              wireId: newWireId, 
              groupId: targetGroupId,
              copiedFrom: wireId
            }
          })
        }
      })
    }
  }
  
  return { state: newState, changes }
}