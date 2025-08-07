import type { NetworkState, ContactState, GroupState, WireState } from '../contexts/NetworkState'

export interface ExtractToGroupOptions {
  contactIds: string[]
  groupName: string
  parentGroupId: string
  position: { x: number; y: number }
}

export function extractContactsToGroup(
  state: NetworkState,
  options: ExtractToGroupOptions
): Partial<NetworkState> {
  const { contactIds, groupName, parentGroupId, position } = options
  
  // Generate new group ID
  const newGroupId = crypto.randomUUID()
  
  // Create the new group
  const newGroup: GroupState = {
    id: newGroupId,
    name: groupName,
    parentId: parentGroupId,
    position,
    contactIds: [],
    subgroupIds: [],
    boundaryContactIds: [],
    isPrimitive: false
  }
  
  // Move contacts to the new group
  const updatedContacts: Record<string, ContactState> = {}
  const updatedGroups: Record<string, GroupState> = {}
  
  // Copy all existing groups
  Object.entries(state.groups).forEach(([id, group]) => {
    updatedGroups[id] = { ...group }
  })
  
  // Add the new group
  updatedGroups[newGroupId] = newGroup
  
  // Update parent group to include new subgroup
  updatedGroups[parentGroupId] = {
    ...updatedGroups[parentGroupId],
    subgroupIds: [...updatedGroups[parentGroupId].subgroupIds, newGroupId],
    // Remove extracted contacts from parent
    contactIds: updatedGroups[parentGroupId].contactIds.filter(id => !contactIds.includes(id))
  }
  
  // Move contacts to new group
  Object.entries(state.contacts).forEach(([id, contact]) => {
    if (contactIds.includes(id)) {
      updatedContacts[id] = {
        ...contact,
        groupId: newGroupId,
        // Adjust position relative to new group
        position: {
          x: contact.position.x - position.x + 60,
          y: contact.position.y - position.y + 30
        }
      }
      // Add to new group's contact list
      updatedGroups[newGroupId].contactIds.push(id)
    } else {
      updatedContacts[id] = contact
    }
  })
  
  // Handle wires - create boundary contacts for external connections
  const updatedWires: Record<string, WireState> = {}
  const newBoundaryContacts: ContactState[] = []
  const externalConnections = new Map<string, Set<string>>() // track which contacts need boundaries
  
  Object.entries(state.wires).forEach(([wireId, wire]) => {
    const fromInGroup = contactIds.includes(wire.fromId)
    const toInGroup = contactIds.includes(wire.toId)
    
    if (fromInGroup && toInGroup) {
      // Both ends in group - keep wire as is
      updatedWires[wireId] = wire
    } else if (fromInGroup || toInGroup) {
      // One end in group - need boundary contact
      const internalId = fromInGroup ? wire.fromId : wire.toId
      const externalId = fromInGroup ? wire.toId : wire.fromId
      
      if (!externalConnections.has(internalId)) {
        externalConnections.set(internalId, new Set())
      }
      externalConnections.get(internalId)!.add(externalId)
    } else {
      // Neither end in group - keep wire as is
      updatedWires[wireId] = wire
    }
  })
  
  // Create boundary contacts for external connections
  externalConnections.forEach((externalIds, internalId) => {
    const internalContact = updatedContacts[internalId]
    const boundaryId = crypto.randomUUID()
    
    // Create boundary contact
    const boundaryContact: ContactState = {
      id: boundaryId,
      groupId: newGroupId,
      content: internalContact.content,
      blendMode: 'accept-last',
      position: {
        x: internalContact.position.x,
        y: internalContact.position.y - 40 // Position above the internal contact
      },
      isBoundary: true,
      boundaryDirection: 'input'
    }
    
    updatedContacts[boundaryId] = boundaryContact
    updatedGroups[newGroupId].boundaryContactIds.push(boundaryId)
    
    // Create internal wire from boundary to internal contact
    const internalWireId = crypto.randomUUID()
    updatedWires[internalWireId] = {
      id: internalWireId,
      groupId: newGroupId,
      fromId: boundaryId,
      toId: internalId,
      type: 'bidirectional'
    }
    
    // Update external wires to connect to boundary
    Object.entries(state.wires).forEach(([wireId, wire]) => {
      if (wire.fromId === internalId) {
        updatedWires[wireId] = { ...wire, fromId: boundaryId }
      } else if (wire.toId === internalId) {
        updatedWires[wireId] = { ...wire, toId: boundaryId }
      }
    })
  })
  
  return {
    contacts: updatedContacts,
    groups: updatedGroups,
    wires: updatedWires
  }
}