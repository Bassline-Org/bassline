// Extract to Group refactoring operation
// This is a VIEW AGNOSTIC operation that only transforms the network state

import type { NetworkState, Contact, Wire, Group } from '../../types'
import type { ExtractToGroupParams, RefactoringResult, RefactoringChange } from '../types'
import { classifyWires, findContactGroup, cloneNetworkState, generateId } from '../utils'

/**
 * Extract selected contacts into a new group
 * 
 * This operation:
 * 1. Creates a new group
 * 2. Moves selected contacts to the new group
 * 3. Creates boundary contacts for external connections
 * 4. Rewires connections appropriately
 */
export function extractToGroup(
  state: NetworkState,
  params: ExtractToGroupParams
): RefactoringResult {
  const { contactIds, groupName, parentGroupId } = params
  const contactIdSet = new Set(contactIds)
  const changes: RefactoringChange[] = []
  
  // Clone the state for immutability
  const newState = cloneNetworkState(state)
  
  // Verify parent group exists
  const parentGroupState = newState.groups.get(parentGroupId)
  if (!parentGroupState) {
    throw new Error(`Parent group ${parentGroupId} not found`)
  }
  
  // Create the new group
  const newGroupId = generateId()
  const newGroup: Group = {
    id: newGroupId,
    name: groupName,
    parentId: parentGroupId,
    contactIds: [],
    wireIds: [],
    subgroupIds: [],
    boundaryContactIds: []
  }
  
  // Add to parent's subgroups
  parentGroupState.group.subgroupIds.push(newGroupId)
  
  // Create the new group state
  const newGroupState = {
    group: newGroup,
    contacts: new Map<string, Contact>(),
    wires: new Map<string, Wire>()
  }
  newState.groups.set(newGroupId, newGroupState)
  
  changes.push({
    type: 'group-created',
    data: { groupId: newGroupId, parentId: parentGroupId }
  })
  
  // Move contacts to the new group
  contactIds.forEach(contactId => {
    const sourceGroupId = findContactGroup(state, contactId)
    if (!sourceGroupId) return
    
    const sourceGroup = newState.groups.get(sourceGroupId)
    if (!sourceGroup) return
    
    const contact = sourceGroup.contacts.get(contactId)
    if (!contact) return
    
    // Remove from source group
    sourceGroup.contacts.delete(contactId)
    sourceGroup.group.contactIds = sourceGroup.group.contactIds.filter(id => id !== contactId)
    
    // Update contact's group reference
    contact.groupId = newGroupId
    
    // Add to new group
    newGroupState.contacts.set(contactId, contact)
    newGroup.contactIds.push(contactId)
    
    changes.push({
      type: 'contact-moved',
      data: { contactId, fromGroup: sourceGroupId, toGroup: newGroupId }
    })
  })
  
  // Handle wires - classify them based on the selection
  const wireClassification = classifyWires(state, contactIdSet)
  
  // Move internal wires to the new group
  wireClassification.internal.forEach(wireId => {
    const sourceGroupId = findWireGroup(state, wireId)
    if (!sourceGroupId) return
    
    const sourceGroup = newState.groups.get(sourceGroupId)
    if (!sourceGroup) return
    
    const wire = sourceGroup.wires.get(wireId)
    if (!wire) return
    
    // Remove from source group
    sourceGroup.wires.delete(wireId)
    sourceGroup.group.wireIds = sourceGroup.group.wireIds.filter(id => id !== wireId)
    
    // Update wire's group reference
    wire.groupId = newGroupId
    
    // Add to new group
    newGroupState.wires.set(wireId, wire)
    newGroup.wireIds.push(wireId)
  })
  
  // Create boundary contacts for external connections
  const boundaryContactMap = new Map<string, string>() // internal contact -> boundary contact
  
  // Handle incoming wires (need input boundary contacts)
  const incomingTargets = new Set<string>()
  wireClassification.incoming.forEach(wireId => {
    const wire = findWireInState(newState, wireId)
    if (wire && contactIdSet.has(wire.toId)) {
      incomingTargets.add(wire.toId)
    }
  })
  
  incomingTargets.forEach(targetContactId => {
    const boundaryId = generateId()
    const boundaryContact: Contact = {
      id: boundaryId,
      groupId: newGroupId,
      content: undefined, // Will receive value from external source
      blendMode: 'accept-last',
      isBoundary: true,
      boundaryDirection: 'input',
      name: `in_${targetContactId.slice(0, 8)}`
    }
    
    // Add boundary contact
    newGroupState.contacts.set(boundaryId, boundaryContact)
    newGroup.contactIds.push(boundaryId)
    newGroup.boundaryContactIds.push(boundaryId)
    
    // Create internal wire from boundary to target
    const internalWireId = generateId()
    const internalWire: Wire = {
      id: internalWireId,
      groupId: newGroupId,
      fromId: boundaryId,
      toId: targetContactId,
      type: 'bidirectional'
    }
    newGroupState.wires.set(internalWireId, internalWire)
    newGroup.wireIds.push(internalWireId)
    
    boundaryContactMap.set(targetContactId, boundaryId)
    
    changes.push({
      type: 'wire-created',
      data: { wireId: internalWireId, groupId: newGroupId }
    })
  })
  
  // Handle outgoing wires (need output boundary contacts)
  const outgoingSources = new Set<string>()
  wireClassification.outgoing.forEach(wireId => {
    const wire = findWireInState(newState, wireId)
    if (wire && contactIdSet.has(wire.fromId)) {
      outgoingSources.add(wire.fromId)
    }
  })
  
  outgoingSources.forEach(sourceContactId => {
    if (boundaryContactMap.has(sourceContactId)) {
      // Already has a boundary (bidirectional case)
      return
    }
    
    const boundaryId = generateId()
    const boundaryContact: Contact = {
      id: boundaryId,
      groupId: newGroupId,
      content: undefined, // Will receive value from internal source
      blendMode: 'accept-last',
      isBoundary: true,
      boundaryDirection: 'output',
      name: `out_${sourceContactId.slice(0, 8)}`
    }
    
    // Add boundary contact
    newGroupState.contacts.set(boundaryId, boundaryContact)
    newGroup.contactIds.push(boundaryId)
    newGroup.boundaryContactIds.push(boundaryId)
    
    // Create internal wire from source to boundary
    const internalWireId = generateId()
    const internalWire: Wire = {
      id: internalWireId,
      groupId: newGroupId,
      fromId: sourceContactId,
      toId: boundaryId,
      type: 'bidirectional'
    }
    newGroupState.wires.set(internalWireId, internalWire)
    newGroup.wireIds.push(internalWireId)
    
    boundaryContactMap.set(sourceContactId, boundaryId)
    
    changes.push({
      type: 'wire-created',
      data: { wireId: internalWireId, groupId: newGroupId }
    })
  })
  
  // Update external wires to connect to boundary contacts
  const externalWires = [...wireClassification.incoming, ...wireClassification.outgoing]
  externalWires.forEach(wireId => {
    const wire = findWireInState(newState, wireId)
    if (!wire) return
    
    let updated = false
    
    // Update incoming wire targets
    if (contactIdSet.has(wire.toId)) {
      const boundaryId = boundaryContactMap.get(wire.toId)
      if (boundaryId) {
        wire.toId = boundaryId
        updated = true
      }
    }
    
    // Update outgoing wire sources
    if (contactIdSet.has(wire.fromId)) {
      const boundaryId = boundaryContactMap.get(wire.fromId)
      if (boundaryId) {
        wire.fromId = boundaryId
        updated = true
      }
    }
    
    if (updated) {
      changes.push({
        type: 'wire-updated',
        data: { wireId, wire }
      })
    }
  })
  
  return { state: newState, changes }
}

// Helper to find a wire anywhere in the state
function findWireInState(state: NetworkState, wireId: string): Wire | undefined {
  for (const groupState of state.groups.values()) {
    const wire = groupState.wires.get(wireId)
    if (wire) return wire
  }
  return undefined
}

// Helper to find which group contains a wire
function findWireGroup(state: NetworkState, wireId: string): string | undefined {
  for (const [groupId, groupState] of state.groups) {
    if (groupState.wires.has(wireId)) {
      return groupId
    }
  }
  return undefined
}