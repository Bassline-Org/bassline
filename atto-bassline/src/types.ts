/**
 * Atto-Bassline: Ultra-minimal strength-based propagation network
 * Core type definitions
 */

// ============================================================================
// Value: JSON-compatible types
// ============================================================================

export type Value = 
  | null
  | boolean
  | number
  | string
  | Value[]
  | { [key: string]: Value }

// ============================================================================
// Signal: Value with strength
// ============================================================================

export interface Signal {
  value: Value
  strength: number
}

// ============================================================================
// Contact: Connection point on a gadget
// ============================================================================

export interface Contact {
  id: string
  direction: 'input' | 'output'
  boundary: boolean
  signal: Signal
  gadget: WeakRef<Gadget>  // Contact belongs to a gadget
  sources: Set<WeakRef<Contact>>  // Who writes to us
  targets: Set<WeakRef<Contact>>  // Who we write to
}

// ============================================================================
// Gadget: Processing unit that owns contacts and sub-gadgets
// ============================================================================

export interface Gadget {
  id: string
  contacts: Map<string, Contact>  // Gadget owns its contacts
  gadgets: Map<string, Gadget>    // Gadget owns its sub-gadgets
  parent?: WeakRef<Gadget>        // Optional parent reference
  
  // Optional compute function for primitive gadgets
  compute?: (inputs: Map<string, Signal>) => Map<string, Signal>
  
  // Mark primitive gadgets that destroy information
  primitive?: boolean
}

// ============================================================================
// Receipt: Audit trail for strength modifications
// ============================================================================

export interface Receipt {
  id: string
  gadgetId: string
  amount: number
  timestamp: number
  reason?: string
}

// ============================================================================
// Helper functions
// ============================================================================

export function createSignal(value: Value = null, strength: number = 0): Signal {
  return { value, strength }
}

export function createContact(
  id: string, 
  gadget: Gadget, 
  initialSignal?: Signal,
  direction: 'input' | 'output' = 'input',
  boundary: boolean = false
): Contact {
  return {
    id,
    direction,
    boundary,
    signal: initialSignal || createSignal(),
    gadget: new WeakRef(gadget),
    sources: new Set(),
    targets: new Set()
  }
}

export function createGadget(id: string, parent?: Gadget): Gadget {
  const gadget: Gadget = {
    id,
    contacts: new Map(),
    gadgets: new Map()
  }
  
  if (parent) {
    gadget.parent = new WeakRef(parent)
  }
  
  return gadget
}

// ============================================================================
// Wire management
// ============================================================================

export function wire(from: Contact, to: Contact): void {
  from.targets.add(new WeakRef(to))
  to.sources.add(new WeakRef(from))
}

export function unwire(from: Contact, to: Contact): void {
  // Clean up dead refs while removing
  const cleanTargets = new Set<WeakRef<Contact>>()
  for (const ref of from.targets) {
    const target = ref.deref()
    if (target && target !== to) {
      cleanTargets.add(ref)
    }
  }
  from.targets = cleanTargets
  
  const cleanSources = new Set<WeakRef<Contact>>()
  for (const ref of to.sources) {
    const source = ref.deref()
    if (source && source !== from) {
      cleanSources.add(ref)
    }
  }
  to.sources = cleanSources
}