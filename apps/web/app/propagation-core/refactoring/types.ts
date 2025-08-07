import type { ContactId, WireId, GroupId } from '../types'
import type { Wire } from '../models/Wire'

// Selection types
export interface Selection {
  contacts: Set<ContactId>
  wires: Set<WireId>
  groups: Set<GroupId>
}

export function createEmptySelection(): Selection {
  return {
    contacts: new Set(),
    wires: new Set(),
    groups: new Set()
  }
}

// Wire classification for refactoring
export interface WireClassification {
  internal: Wire[]      // Both endpoints in selection
  incoming: Wire[]      // From outside to selection  
  outgoing: Wire[]      // From selection to outside
  external: Wire[]      // Both endpoints outside (ignored)
}

// Connection validation
export interface ConnectionValidationResult {
  valid: boolean
  errors: string[]
}

// Refactoring result
export interface RefactoringResult {
  success: boolean
  errors?: string[]
  affectedContacts?: ContactId[]
  affectedWires?: WireId[]
  newGroups?: GroupId[]
}