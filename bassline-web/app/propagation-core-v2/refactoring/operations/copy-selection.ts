// Copy Selection refactoring operation
// This handles mixed selections of contacts and groups

import type { NetworkState } from '../../types'
import type { RefactoringResult, RefactoringChange } from '../types'
import { copyContacts } from './copy-contacts'
import { copyGroup } from './copy-group'
import { cloneNetworkState } from '../utils'

export interface CopySelectionParams {
  contactIds: string[]
  groupIds: string[]
  targetGroupId: string
  includeWires?: boolean
  deep?: boolean
}

/**
 * Copy a mixed selection of contacts and groups
 * 
 * This operation:
 * 1. Copies all selected contacts to the target group
 * 2. Copies all selected groups as siblings in the target group
 * 3. Preserves wires between copied elements
 * 4. Handles the case where contacts are inside selected groups
 */
export function copySelection(
  state: NetworkState,
  params: CopySelectionParams
): RefactoringResult {
  const { contactIds, groupIds, targetGroupId, includeWires = true, deep = true } = params
  const changes: RefactoringChange[] = []
  
  // Start with cloned state
  let currentState = cloneNetworkState(state)
  
  // Track all copied contact IDs (including those from copied groups)
  const allCopiedContactIds = new Set<string>()
  const contactIdMap = new Map<string, string>() // old -> new
  
  // First, copy all standalone contacts
  if (contactIds.length > 0) {
    // Filter out contacts that are inside groups we're copying
    const standaloneContacts = contactIds.filter(contactId => {
      // Find which group contains this contact
      for (const [groupId, groupState] of currentState.groups) {
        if (groupState.contacts.has(contactId)) {
          // Check if this group is being copied
          return !groupIds.includes(groupId)
        }
      }
      return true
    })
    
    if (standaloneContacts.length > 0) {
      const contactResult = copyContacts(currentState, {
        contactIds: standaloneContacts,
        targetGroupId,
        includeWires: false // We'll handle wires at the end
      })
      
      currentState = contactResult.state
      changes.push(...contactResult.changes)
      
      // Track the mappings
      contactResult.changes.forEach(change => {
        if (change.type === 'contact-created' && change.data) {
          const data = change.data as any
          if (data.copiedFrom) {
            contactIdMap.set(data.copiedFrom, data.contactId)
            allCopiedContactIds.add(data.contactId)
          }
        }
      })
    }
  }
  
  // Then, copy all groups
  const groupIdMap = new Map<string, string>() // old -> new
  
  for (const groupId of groupIds) {
    const groupResult = copyGroup(currentState, {
      groupId,
      targetParentId: targetGroupId,
      deep
    })
    
    currentState = groupResult.state
    changes.push(...groupResult.changes)
    
    // Track group and contact mappings from the copy
    groupResult.changes.forEach(change => {
      if (change.type === 'group-created' && change.data) {
        const data = change.data as any
        if (data.copiedFrom) {
          groupIdMap.set(data.copiedFrom, data.groupId)
        }
      } else if (change.type === 'contact-created' && change.data) {
        const data = change.data as any
        if (data.copiedFrom) {
          contactIdMap.set(data.copiedFrom, data.contactId)
          allCopiedContactIds.add(data.contactId)
        }
      }
    })
  }
  
  // Now handle wires if requested
  if (includeWires) {
    const targetGroupState = currentState.groups.get(targetGroupId)
    if (targetGroupState) {
      const copiedWireIds = new Set<string>()
      
      // Look through all wires in all groups
      for (const [groupId, groupState] of currentState.groups) {
        groupState.wires.forEach((wire, wireId) => {
          const newFromId = contactIdMap.get(wire.fromId)
          const newToId = contactIdMap.get(wire.toId)
          
          // Check if both endpoints were copied
          if (newFromId && newToId && !copiedWireIds.has(wireId)) {
            // Create a new wire in the target group
            const newWireId = crypto.randomUUID()
            const newWire = {
              id: newWireId,
              groupId: targetGroupId,
              fromId: newFromId,
              toId: newToId,
              type: wire.type
            }
            
            targetGroupState.wires.set(newWireId, newWire)
            targetGroupState.group.wireIds.push(newWireId)
            copiedWireIds.add(wireId)
            
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
  }
  
  return { state: currentState, changes }
}