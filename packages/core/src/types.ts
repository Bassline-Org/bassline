// Core data types - pure data, no behavior

// ============================================================================
// Utility Types
// ============================================================================

// Lazy evaluation pattern
export type Lazy<T> = () => T
export type MaybeLazy<T> = T | Lazy<T>

// Result type for error handling
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E }

// Branded types for type-safe IDs
export type ContactId = string & { __brand: 'ContactId' }
export type GroupId = string & { __brand: 'GroupId' }
export type WireId = string & { __brand: 'WireId' }
export type NetworkId = string & { __brand: 'NetworkId' }
export type SnapshotId = string & { __brand: 'SnapshotId' }

// Helper functions for branded types
export const brand = {
  contactId: (id: string): ContactId => id as ContactId,
  groupId: (id: string): GroupId => id as GroupId,
  wireId: (id: string): WireId => id as WireId,
  networkId: (id: string): NetworkId => id as NetworkId,
  snapshotId: (id: string): SnapshotId => id as SnapshotId,
} as const


// ============================================================================
// Domain Types
// ============================================================================

// Bassline attributes will be defined by the bassline package
export type BasslineAttributes = Record<string, any>

export type BlendMode = 'accept-last' | 'merge';
export type BoundaryDirection = 'input' | 'output';
export type WireType = 'bidirectional' | 'directed';

export interface Contact {
  id: ContactId
  groupId: GroupId
  content?: unknown
  blendMode: BlendMode
  isBoundary?: boolean
  boundaryDirection?: BoundaryDirection
  lastContradiction?: Contradiction
  name?: string
  // Bassline attributes for this contact
  attributes?: BasslineAttributes
}

export interface Wire {
  id: WireId
  groupId: GroupId
  fromId: ContactId
  toId: ContactId
  type: WireType
  // Bassline attributes for this wire
  attributes?: BasslineAttributes
}

export type GroupLocation = 'local' | { type: 'remote', url: string }

export interface Group {
  id: GroupId
  name: string
  parentId?: GroupId
  contactIds: ContactId[]
  wireIds: WireId[]
  subgroupIds: GroupId[]
  boundaryContactIds: ContactId[]
  // Group can be local or remote
  location?: GroupLocation
  // If present, this group behaves as a primitive gadget
  primitive?: PrimitiveGadget
  // Bassline attributes for this group/gadget
  attributes?: BasslineAttributes
}

export interface PrimitiveGadget {
  // Identity
  id: string
  name: string
  
  // Boundary contact names for inputs/outputs
  // These map to actual contact IDs when the gadget is instantiated
  inputs: string[]   // e.g., ['a', 'b'] for an add gadget
  outputs: string[]  // e.g., ['sum'] for an add gadget
  
  // When should this gadget execute?
  activation: (inputs: Map<string, unknown>) => boolean
  
  // What computation to perform
  body: (inputs: Map<string, unknown>) => Promise<Map<string, unknown>>
  
  // Metadata
  description?: string
  category?: 'math' | 'string' | 'array' | 'logic' | 'control' | 'custom' | 'io' | 'data' | 'time'
  isPure?: boolean  // Whether this gadget has side effects (false = impure/has side effects)
}

export interface Contradiction {
  message: string
  values: unknown[]
  timestamp: number
}

// ============================================================================
// Operation Types (Tagged Unions)
// ============================================================================

// Wire creation variants
export type WireCreation = 
  | { kind: 'bidirectional'; from: ContactId; to: ContactId }
  | { kind: 'directed'; from: ContactId; to: ContactId }
  | { kind: 'constraint'; from: ContactId; to: ContactId; strength?: number }

// Contact creation variants
export type ContactCreation =
  | { kind: 'simple'; blendMode: BlendMode; content?: unknown; name?: string }
  | { kind: 'boundary'; direction: BoundaryDirection; content?: unknown; name?: string }
  | { kind: 'dynamic'; resolver: Lazy<Contact> }

// Group creation variants
export type GroupCreation =
  | { kind: 'normal'; name: string; attributes?: BasslineAttributes }
  | { kind: 'primitive'; name: string; primitive: PrimitiveGadget }
  | { kind: 'remote'; name: string; url: string }

// Network events
export type NetworkEvent =
  | { type: 'contact.created'; contact: Contact; groupId: GroupId }
  | { type: 'contact.updated'; before: Contact; after: Contact }
  | { type: 'contact.deleted'; contactId: ContactId; groupId: GroupId }
  | { type: 'wire.created'; wire: Wire; groupId: GroupId }
  | { type: 'wire.deleted'; wireId: WireId; groupId: GroupId }
  | { type: 'group.created'; group: Group; parentId?: GroupId }
  | { type: 'group.deleted'; groupId: GroupId }
  | { type: 'propagation.started'; fromId: ContactId }
  | { type: 'propagation.completed'; changes: ContactUpdate[] }
  | { type: 'propagation.failed'; error: Error }

// State containers
export interface GroupState {
  group: Group
  contacts: Map<string, Contact>
  wires: Map<string, Wire>
}

export interface NetworkState {
  groups: Map<string, GroupState>
  currentGroupId: string
  rootGroupId: string
}

// Propagation types
export interface PropagationTask {
  id: string
  groupId: string
  contactId: string
  content: unknown
  sourceId?: string
  priority?: number
  timestamp: number
}

export interface ContactUpdate {
  contactId: string
  updates: Partial<Contact>
}

export interface Change {
  type: 'contact-removed' | 'contact-updated' | 'wire-added' | 'wire-removed' | 'group-added' | 'group-removed' | 'group-updated' | 'contact-added'
  data: unknown
  timestamp: number
}

export interface PropagationResult {
  changes: ContactUpdate[]
  contradictions: Array<{ contactId: string; contradiction: Contradiction }>
  duration: number
}

// Scheduler interface
export interface PropagationNetworkScheduler {
  // Register a group (local or remote)
  registerGroup: (group: Group) => Promise<void>
  
  // Schedule a content update
  scheduleUpdate: (contactId: string, content: unknown) => Promise<void>
  
  // Schedule a propagation from a contact
  schedulePropagation: (fromContactId: string, toContactId: string, content: unknown) => Promise<void>
  
  // Connection operations
  connect: (fromId: string, toId: string, type?: 'bidirectional' | 'directed') => Promise<string>
  disconnect: (wireId: string) => Promise<void>
  
  // Contact operations
  addContact: (groupId: string, contact: Omit<Contact, 'id'>) => Promise<string>
  removeContact: (contactId: string) => Promise<void>
  
  // Group operations
  addGroup: (parentGroupId: string, group: Omit<Group, 'id' | 'parentId' | 'contactIds' | 'wireIds' | 'subgroupIds' | 'boundaryContactIds'>) => Promise<string>
  removeGroup: (groupId: string) => Promise<void>
  
  // Get current state (for queries)
  getState: (groupId: string) => Promise<GroupState>
  getContact: (contactId: string) => Promise<Contact | undefined>
  getWire: (wireId: string) => Promise<Wire | undefined>
  
  // Subscribe to changes
  subscribe: (callback: (changes: Change[]) => void) => () => void
  
  // State import/export for refactoring operations
  exportState?: () => Promise<NetworkState>
  importState?: (state: NetworkState) => Promise<void>
}

// Remote group proxy for distributed scheduling
export interface RemoteGroupProxy {
  scheduleUpdate: (contactId: string, content: unknown) => Promise<void>
  getState: () => Promise<GroupState>
}

// Re-export commonly used types
export type { Serializable } from './serialization'
export type { Scheduler } from './kernel/drivers/scheduler-driver'