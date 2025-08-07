// Utility functions for refactoring operations
// These are pure functions that help with common refactoring tasks

import type { NetworkState, GroupState, Wire } from '../types'
import type { WireClassification } from './types'

/**
 * Classify wires based on their relationship to a set of contacts
 */
export function classifyWires(
  state: NetworkState,
  contactIds: Set<string>
): WireClassification {
  const internal: string[] = []
  const incoming: string[] = []
  const outgoing: string[] = []
  const crossing: string[] = []

  // Check all wires in all groups
  state.groups.forEach(groupState => {
    groupState.wires.forEach(wire => {
      const fromInSet = contactIds.has(wire.fromId)
      const toInSet = contactIds.has(wire.toId)

      if (fromInSet && toInSet) {
        internal.push(wire.id)
      } else if (!fromInSet && toInSet) {
        incoming.push(wire.id)
      } else if (fromInSet && !toInSet) {
        outgoing.push(wire.id)
      }
      // If neither endpoint is in the set, we don't include it
    })
  })

  return { internal, incoming, outgoing, crossing }
}

/**
 * Find which group contains a contact
 */
export function findContactGroup(
  state: NetworkState,
  contactId: string
): string | undefined {
  for (const [groupId, groupState] of state.groups) {
    if (groupState.contacts.has(contactId)) {
      return groupId
    }
  }
  return undefined
}

/**
 * Find which group contains a wire
 */
export function findWireGroup(
  state: NetworkState,
  wireId: string
): string | undefined {
  for (const [groupId, groupState] of state.groups) {
    if (groupState.wires.has(wireId)) {
      return groupId
    }
  }
  return undefined
}

/**
 * Deep clone a network state
 */
export function cloneNetworkState(state: NetworkState): NetworkState {
  const newGroups = new Map()
  
  state.groups.forEach((groupState, groupId) => {
    // Clone the group
    const newGroup = { ...groupState.group }
    
    // Clone contacts map
    const newContacts = new Map()
    groupState.contacts.forEach((contact, contactId) => {
      newContacts.set(contactId, { ...contact })
    })
    
    // Clone wires map
    const newWires = new Map()
    groupState.wires.forEach((wire, wireId) => {
      newWires.set(wireId, { ...wire })
    })
    
    newGroups.set(groupId, {
      group: newGroup,
      contacts: newContacts,
      wires: newWires
    })
  })
  
  return {
    groups: newGroups,
    currentGroupId: state.currentGroupId,
    rootGroupId: state.rootGroupId
  }
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return crypto.randomUUID()
}