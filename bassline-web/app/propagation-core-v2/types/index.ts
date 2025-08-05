// Core data types - pure data, no behavior

export interface Contact {
  id: string
  groupId: string
  content?: unknown
  blendMode: 'accept-last' | 'merge'
  isBoundary?: boolean
  boundaryDirection?: 'input' | 'output'
  lastContradiction?: Contradiction
  name?: string
}

export interface Wire {
  id: string
  groupId: string
  fromId: string
  toId: string
  type: 'bidirectional' | 'directed'
}

export interface Group {
  id: string
  name: string
  parentId?: string
  contactIds: string[]
  wireIds: string[]
  subgroupIds: string[]
  boundaryContactIds: string[]
  // Group can be local or remote
  location?: 'local' | { type: 'remote', url: string }
  // If present, this group behaves as a primitive gadget
  primitive?: PrimitiveGadget
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
  category?: 'math' | 'string' | 'array' | 'logic' | 'control' | 'custom'
}

export interface Contradiction {
  message: string
  values: unknown[]
  timestamp: number
}

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
  type: 'contact-updated' | 'wire-added' | 'wire-removed' | 'group-added' | 'group-removed'
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
}

// Remote group proxy for distributed scheduling
export interface RemoteGroupProxy {
  scheduleUpdate: (contactId: string, content: unknown) => Promise<void>
  getState: () => Promise<GroupState>
}