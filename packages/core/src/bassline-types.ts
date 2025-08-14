/**
 * Bassline Types - Reified data structures for meta-propagation
 * 
 * A "bassline" is the reified data representation of a network's structure and behavior.
 * Everything here is pure data that can be constructed from within the network itself.
 */

import type { ContactId, GroupId, WireId, BlendMode, BoundaryDirection, WireType } from './types'

// ============================================================================
// Reified Data Structures (Pure Data)
// ============================================================================

/**
 * ReifiedContact - A contact as pure data
 * Can be built from within the network using gadgets
 */
export interface ReifiedContact {
  id: ContactId
  groupId: GroupId
  content?: unknown
  blendMode: BlendMode
  isBoundary?: boolean
  boundaryDirection?: BoundaryDirection
  name?: string
  metadata?: Record<string, unknown>
}

/**
 * ReifiedWire - A wire as pure data
 */
export interface ReifiedWire {
  id: WireId
  groupId: GroupId
  fromId: ContactId  // Always contact to contact!
  toId: ContactId
  type: WireType
  metadata?: Record<string, unknown>
}

/**
 * ReifiedGroup - A group as pure data
 */
export interface ReifiedGroup {
  id: GroupId
  name: string
  parentId?: GroupId
  capabilities: Set<Capability>
  primitive?: ReifiedPrimitive
  metadata?: Record<string, unknown>
}

/**
 * ReifiedPrimitive - A primitive gadget as data
 */
export interface ReifiedPrimitive {
  id: string
  name: string
  inputs: string[]
  outputs: string[]
  // Note: activation and body are functions, harder to reify
  // May need to reference by ID or use serializable representation
}

/**
 * ReifiedGadget - A gadget instance as data
 */
export interface ReifiedGadget {
  id: string
  type: 'primitive' | 'composite' | 'bassline' | 'dynamicBassline'
  groupId: GroupId
  primitive?: string  // Reference to primitive by ID
  bassline?: Bassline  // For composite gadgets
  metadata?: Record<string, unknown>
}

// ============================================================================
// The Bassline - Complete Network Representation
// ============================================================================

/**
 * Bassline - The complete reified representation of a network
 * This IS what a network is - its data representation
 */
export interface Bassline {
  // Structure
  contacts: Map<ContactId, ReifiedContact>
  wires: Map<WireId, ReifiedWire>
  groups: Map<GroupId, ReifiedGroup>
  gadgets: Map<string, ReifiedGadget>
  
  // Behavior (optional, based on capabilities)
  scheduler?: SchedulerType | ReifiedScheduler
  blendModes?: Map<string, BlendFunction>
  propagationRules?: ReifiedPropagationRules
  
  // Meta
  capabilities: Set<Capability>
  version: string
  metadata?: Record<string, unknown>
}

// ============================================================================
// Actions as Data
// ============================================================================

/**
 * ReifiedAction - Mutations as data structures
 * These flow through contacts to modify basslines
 */
export type ReifiedAction = 
  | ['addContact', ReifiedContact]
  | ['removeContact', ContactId]
  | ['updateContact', ContactId, unknown]
  | ['addWire', ReifiedWire]
  | ['removeWire', WireId]
  | ['addGroup', ReifiedGroup]
  | ['removeGroup', GroupId]
  | ['setScheduler', SchedulerType | ReifiedScheduler]
  | ['setCapability', Capability, boolean]
  | ['applyBassline', Bassline]  // Apply a complete bassline

/**
 * ActionSet - A collection of actions to apply
 */
export interface ActionSet {
  actions: ReifiedAction[]
  timestamp?: number
  source?: string  // Who generated these actions
  metadata?: Record<string, unknown>
}

// ============================================================================
// Capabilities
// ============================================================================

/**
 * Capability - What a bassline can do
 */
export type Capability = 
  // Read-only
  | 'bassline.observe'              // Can read the bassline
  | 'bassline.observe.actions'      // Can see action stream
  
  // Modification
  | 'bassline.modify'               // Can modify the bassline via actions
  | 'bassline.modify.scheduler'     // Can change scheduler
  | 'bassline.modify.structure'     // Can add/remove contacts, wires, groups
  
  // Creation
  | 'bassline.spawn'                // Can create sub-basslines
  | 'bassline.compose'              // Can compose basslines
  | 'bassline.instantiate'          // Can instantiate dynamic basslines
  
  // Advanced
  | 'bassline.reflection.full'      // Full bassline introspection
  | 'bassline.intercession'         // Can modify actions in flight
  | 'bassline.reify'                // Can reify new concepts
  
  // Dangerous
  | 'bassline.capabilities'         // Can modify own capabilities
  | 'bassline.meta'                 // Can modify the bassline gadget itself

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * SchedulerType - Built-in scheduler types
 */
export type SchedulerType = 'immediate' | 'batch' | 'async' | 'custom'

/**
 * ReifiedScheduler - The scheduler as data
 * 
 * A scheduler manages propagation through a work queue.
 * When the queue is empty, the network is stable.
 */
export interface ReifiedScheduler {
  type: 'immediate' | 'batch' | 'custom'
  pendingTasks: Array<{
    type: 'propagate'
    fromContactId: string
    toContactId: string
    value: any
  }>
  processTask: (task: any, bassline: Bassline, values: Map<string, any>) => void
}

/**
 * BlendFunction - How to merge values
 */
export type BlendFunction = (current: unknown, incoming: unknown) => unknown

/**
 * ReifiedPropagationRules - Propagation rules as data
 */
export interface ReifiedPropagationRules {
  maxDepth?: number
  cycleHandling?: 'detect' | 'allow' | 'break'
  directionality?: 'bidirectional' | 'directed'
  metadata?: Record<string, unknown>
}

// ============================================================================
// Merge Policies
// ============================================================================

/**
 * MergePolicy - How to handle action conflicts
 */
export interface MergePolicy {
  onConflict: 'last-write-wins' | 'merge' | 'reject' | 'custom'
  ordering: 'timestamp' | 'causal' | 'total'
  batching: 'immediate' | 'delayed' | 'transaction'
  customResolver?: (a: ReifiedAction, b: ReifiedAction) => ReifiedAction[]
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an empty bassline
 */
export function createEmptyBassline(capabilities: Set<Capability> = new Set()): Bassline {
  return {
    contacts: new Map(),
    wires: new Map(),
    groups: new Map(),
    gadgets: new Map(),
    capabilities,
    version: '1.0.0'
  }
}

/**
 * Check if a bassline has a capability
 */
export function hasCapability(bassline: Bassline, capability: Capability): boolean {
  return bassline.capabilities.has(capability)
}

/**
 * Apply an action to a bassline (pure function)
 */
export function applyAction(bassline: Bassline, action: ReifiedAction): Bassline {
  // This is a pure function - returns new bassline
  const newBassline = { ...bassline }
  
  switch (action[0]) {
    case 'addContact': {
      const contact = action[1]
      newBassline.contacts = new Map(bassline.contacts)
      newBassline.contacts.set(contact.id, contact)
      break
    }
    
    case 'removeContact': {
      const contactId = action[1]
      newBassline.contacts = new Map(bassline.contacts)
      newBassline.contacts.delete(contactId)
      break
    }
    
    case 'updateContact': {
      const [_, contactId, content] = action
      const existing = bassline.contacts.get(contactId)
      if (existing) {
        newBassline.contacts = new Map(bassline.contacts)
        newBassline.contacts.set(contactId, { ...existing, content })
      }
      break
    }
    
    case 'addWire': {
      const wire = action[1]
      newBassline.wires = new Map(bassline.wires)
      newBassline.wires.set(wire.id, wire)
      break
    }
    
    case 'removeWire': {
      const wireId = action[1]
      newBassline.wires = new Map(bassline.wires)
      newBassline.wires.delete(wireId)
      break
    }
    
    case 'addGroup': {
      const group = action[1]
      newBassline.groups = new Map(bassline.groups)
      newBassline.groups.set(group.id, group)
      break
    }
    
    case 'removeGroup': {
      const groupId = action[1]
      newBassline.groups = new Map(bassline.groups)
      newBassline.groups.delete(groupId)
      break
    }
    
    case 'setCapability': {
      const [_, capability, enabled] = action
      newBassline.capabilities = new Set(bassline.capabilities)
      if (enabled) {
        newBassline.capabilities.add(capability)
      } else {
        newBassline.capabilities.delete(capability)
      }
      break
    }
    
    case 'applyBassline': {
      // Replace entire bassline
      return action[1]
    }
    
    // Add more action types as needed
  }
  
  return newBassline
}

/**
 * Apply multiple actions to a bassline
 */
export function applyActionSet(bassline: Bassline, actionSet: ActionSet): Bassline {
  return actionSet.actions.reduce((b, action) => applyAction(b, action), bassline)
}