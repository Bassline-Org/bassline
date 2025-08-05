// Refactoring operation types
// All operations are VIEW AGNOSTIC - they operate only on the data model

import type { NetworkState } from '../types'

// Result of a refactoring operation
export interface RefactoringResult {
  state: NetworkState
  changes: RefactoringChange[]
}

// Types of changes for efficient UI updates
export interface RefactoringChange {
  type: 'contact-moved' | 'group-created' | 'group-deleted' | 'wire-created' | 'wire-deleted' | 'wire-updated'
  data: unknown
}

// Selection for refactoring operations
// Note: This is just IDs, no UI positions or visual properties
export interface RefactoringSelection {
  contactIds: Set<string>
  groupIds: Set<string>
  wireIds: Set<string>
}

// Wire classification for refactoring
export interface WireClassification {
  internal: string[]      // Both endpoints in selection
  incoming: string[]      // From outside to selection  
  outgoing: string[]      // From selection to outside
  crossing: string[]      // One endpoint in each selection
}

// Validation result
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

// Base parameters for all refactoring operations
export interface RefactoringParams {
  // Common params can go here
}

// Extract to group parameters
export interface ExtractToGroupParams extends RefactoringParams {
  contactIds: string[]
  groupName: string
  parentGroupId: string
}

// Inline group parameters
export interface InlineGroupParams extends RefactoringParams {
  groupId: string
}

// Copy contacts parameters
export interface CopyContactsParams extends RefactoringParams {
  contactIds: string[]
  targetGroupId: string
  includeWires?: boolean  // Copy wires between copied contacts
}

// Copy group parameters
export interface CopyGroupParams extends RefactoringParams {
  groupId: string
  targetParentId: string
  newName?: string
  deep?: boolean  // Deep copy including subgroups
}