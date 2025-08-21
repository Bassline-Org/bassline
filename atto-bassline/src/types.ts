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
  strength: number  // Integer strength in units (10000 = 1.0)
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
  
  // Local gain pool for amplification (in strength units)
  gainPool: number
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
  // strength is already in integer units
  return { value, strength }
}

/**
 * Create a signal with decimal strength (convenience function)
 * @param value The signal value
 * @param strength Decimal strength (0.0 to 1.0+), will be converted to units
 */
export function signal(value: Value = null, strength: number = 0): Signal {
  const units = Math.round(strength * 10000)  // Convert to integer units
  return { value, strength: units }
}

/**
 * Calculate output strength for primitive gadgets
 * Returns the average of all input strengths (excludes outputs)
 */
export function calculatePrimitiveOutputStrength(inputs: Map<string, Signal>, gadget?: Gadget): number {
  const inputStrengths: number[] = []
  
  // If gadget is provided, filter to only input contacts
  if (gadget) {
    for (const [name, signal] of inputs) {
      const contact = gadget.contacts.get(name)
      if (contact?.direction === 'input') {
        inputStrengths.push(signal.strength)
      }
    }
  } else {
    // Fallback: use all signals (for backwards compatibility)
    inputStrengths.push(...Array.from(inputs.values()).map(s => s.strength))
  }
  
  if (inputStrengths.length === 0) return 0
  return Math.floor(inputStrengths.reduce((sum, s) => sum + s, 0) / inputStrengths.length)
}

export function createContact(
  id: string, 
  gadget: Gadget, 
  initialSignal?: Signal,
  direction: 'input' | 'output' = 'input',
  boundary: boolean = false
): Contact {
  const contact: Contact = {
    id,
    direction,
    boundary,
    signal: initialSignal || createSignal(),
    gadget: new WeakRef(gadget),
    sources: new Set<WeakRef<Contact>>(),
    targets: new Set<WeakRef<Contact>>()
  }
  
  return contact
}

export function createGadget(id: string, parent?: Gadget): Gadget {
  const gadget: Gadget = {
    id,
    contacts: new Map(),
    gadgets: new Map(),
    gainPool: 0  // Start with no gain
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
  if (!from) {
    throw new Error('Cannot wire: source contact is null/undefined')
  }
  if (!to) {
    throw new Error('Cannot wire: target contact is null/undefined')
  }
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