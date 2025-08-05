// Copy Group refactoring operation
// This is a VIEW AGNOSTIC operation that only transforms the network state

import type { NetworkState, Group, Contact, Wire } from '../../types'
import type { CopyGroupParams, RefactoringResult, RefactoringChange } from '../types'
import { cloneNetworkState, generateId } from '../utils'

/**
 * Copy a group (and optionally its subgroups) to a target parent
 * 
 * This operation:
 * 1. Creates a copy of the group structure
 * 2. Copies all contacts and internal wires
 * 3. Creates new boundary contacts
 * 4. Optionally performs deep copy of subgroups
 * 5. Does NOT copy external connections
 */
export function copyGroup(
  state: NetworkState,
  params: CopyGroupParams
): RefactoringResult {
  const { groupId, targetParentId, newName, deep = true } = params
  const changes: RefactoringChange[] = []
  
  // Clone the state for immutability
  const newState = cloneNetworkState(state)
  
  // Get source group
  const sourceGroupState = newState.groups.get(groupId)
  if (!sourceGroupState) {
    throw new Error(`Source group ${groupId} not found`)
  }
  
  // Get target parent
  const targetParentState = newState.groups.get(targetParentId)
  if (!targetParentState) {
    throw new Error(`Target parent group ${targetParentId} not found`)
  }
  
  // Don't allow copying into self or descendants
  if (isDescendantOf(newState, targetParentId, groupId)) {
    throw new Error('Cannot copy group into itself or its descendants')
  }
  
  // Perform the copy
  const result = copyGroupRecursive(
    newState,
    sourceGroupState,
    targetParentId,
    newName || `${sourceGroupState.group.name} (Copy)`,
    deep,
    changes
  )
  
  // Add to parent's subgroups
  targetParentState.group.subgroupIds.push(result.newGroupId)
  
  return { state: newState, changes }
}

/**
 * Recursively copy a group and its contents
 */
function copyGroupRecursive(
  state: NetworkState,
  sourceGroupState: { group: Group; contacts: Map<string, Contact>; wires: Map<string, Wire> },
  targetParentId: string,
  groupName: string,
  deep: boolean,
  changes: RefactoringChange[]
): { newGroupId: string; contactIdMap: Map<string, string> } {
  const sourceGroup = sourceGroupState.group
  
  // Create new group
  const newGroupId = generateId()
  const newGroup: Group = {
    id: newGroupId,
    name: groupName,
    parentId: targetParentId,
    contactIds: [],
    wireIds: [],
    subgroupIds: [],
    boundaryContactIds: [],
    // Copy primitive reference if it's a gadget
    primitive: sourceGroup.primitive
  }
  
  // Create group state
  const newGroupState = {
    group: newGroup,
    contacts: new Map<string, Contact>(),
    wires: new Map<string, Wire>()
  }
  state.groups.set(newGroupId, newGroupState)
  
  changes.push({
    type: 'group-created',
    data: { 
      groupId: newGroupId, 
      parentId: targetParentId,
      copiedFrom: sourceGroup.id
    }
  })
  
  // Map old IDs to new IDs
  const contactIdMap = new Map<string, string>()
  
  // Copy all contacts
  sourceGroupState.contacts.forEach((contact, oldContactId) => {
    const newContactId = generateId()
    const newContact: Contact = {
      ...contact,
      id: newContactId,
      groupId: newGroupId
    }
    
    newGroupState.contacts.set(newContactId, newContact)
    newGroup.contactIds.push(newContactId)
    
    if (contact.isBoundary) {
      newGroup.boundaryContactIds.push(newContactId)
    }
    
    contactIdMap.set(oldContactId, newContactId)
    
    changes.push({
      type: 'contact-created',
      data: { 
        contactId: newContactId, 
        groupId: newGroupId,
        copiedFrom: oldContactId
      }
    })
  })
  
  // Copy all internal wires
  sourceGroupState.wires.forEach((wire, oldWireId) => {
    const newFromId = contactIdMap.get(wire.fromId)
    const newToId = contactIdMap.get(wire.toId)
    
    // Only copy if both endpoints exist in the new group
    if (newFromId && newToId) {
      const newWireId = generateId()
      const newWire: Wire = {
        id: newWireId,
        groupId: newGroupId,
        fromId: newFromId,
        toId: newToId,
        type: wire.type
      }
      
      newGroupState.wires.set(newWireId, newWire)
      newGroup.wireIds.push(newWireId)
      
      changes.push({
        type: 'wire-created',
        data: { 
          wireId: newWireId, 
          groupId: newGroupId,
          copiedFrom: oldWireId
        }
      })
    }
  })
  
  // Deep copy subgroups if requested
  if (deep && sourceGroup.subgroupIds.length > 0) {
    for (const subgroupId of sourceGroup.subgroupIds) {
      const subgroupState = state.groups.get(subgroupId)
      if (subgroupState) {
        const subResult = copyGroupRecursive(
          state,
          subgroupState,
          newGroupId,
          subgroupState.group.name,
          deep,
          changes
        )
        newGroup.subgroupIds.push(subResult.newGroupId)
      }
    }
  }
  
  return { newGroupId, contactIdMap }
}

/**
 * Check if a group is a descendant of another group
 */
function isDescendantOf(state: NetworkState, possibleDescendant: string, ancestor: string): boolean {
  if (possibleDescendant === ancestor) return true
  
  const group = state.groups.get(possibleDescendant)
  if (!group || !group.group.parentId) return false
  
  return isDescendantOf(state, group.group.parentId, ancestor)
}