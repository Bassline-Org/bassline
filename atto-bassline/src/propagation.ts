/**
 * Propagation engine with strength-based argmax resolution
 */

import { Signal, Contact, Gadget } from './types'

// ============================================================================
// Configuration
// ============================================================================

export const HYSTERESIS = 0.01  // Prevent oscillation for near-equal strengths

// ============================================================================
// Core propagation
// ============================================================================

/**
 * Propagate a signal to a contact using argmax with hysteresis
 */
export function propagate(contact: Contact, signal: Signal): void {
  // Argmax with hysteresis: only update if new signal is stronger
  if (signal.strength <= contact.signal.strength + HYSTERESIS) {
    return  // No change, signal not strong enough
  }
  
  // Update the contact's signal
  contact.signal = signal
  
  // Check if this contact belongs to a gadget that needs to compute
  const gadget = contact.gadget.deref()
  if (gadget?.compute) {
    // Gather all input signals
    const inputs = gatherInputs(gadget)
    
    // Compute outputs
    const outputs = gadget.compute(inputs)
    
    // Propagate outputs
    for (const [name, outputSignal] of outputs) {
      const outputContact = gadget.contacts.get(name)
      if (outputContact) {
        // Recursively propagate from this output
        propagate(outputContact, outputSignal)
      }
    }
  }
  
  // Forward to all target contacts (dumb wire behavior)
  for (const targetRef of contact.targets) {
    const target = targetRef.deref()
    if (target) {
      propagate(target, signal)
    }
  }
}

/**
 * Gather all input signals for a gadget
 */
function gatherInputs(gadget: Gadget): Map<string, Signal> {
  const inputs = new Map<string, Signal>()
  
  for (const [name, contact] of gadget.contacts) {
    // Only gather contacts that have sources (are inputs)
    // or explicitly marked as inputs by convention
    if (contact.sources.size > 0 || name.includes('input') || name === 'a' || name === 'b') {
      inputs.set(name, contact.signal)
    }
  }
  
  return inputs
}

// ============================================================================
// Batch propagation
// ============================================================================

/**
 * Set multiple contacts at once, useful for initialization
 */
export function setContacts(updates: Array<[Contact, Signal]>): void {
  for (const [contact, signal] of updates) {
    propagate(contact, signal)
  }
}

// ============================================================================
// Network helpers
// ============================================================================

/**
 * Find all reachable contacts from a starting point
 */
export function findReachable(start: Contact, visited = new Set<Contact>()): Set<Contact> {
  if (visited.has(start)) return visited
  visited.add(start)
  
  for (const targetRef of start.targets) {
    const target = targetRef.deref()
    if (target) {
      findReachable(target, visited)
    }
  }
  
  return visited
}

/**
 * Clean up dead weak references in the network
 */
export function cleanDeadRefs(gadget: Gadget): void {
  // Clean contacts
  for (const contact of gadget.contacts.values()) {
    const liveSources = new Set<WeakRef<Contact>>()
    for (const ref of contact.sources) {
      if (ref.deref()) liveSources.add(ref)
    }
    contact.sources = liveSources
    
    const liveTargets = new Set<WeakRef<Contact>>()
    for (const ref of contact.targets) {
      if (ref.deref()) liveTargets.add(ref)
    }
    contact.targets = liveTargets
  }
  
  // Recursively clean sub-gadgets
  for (const subgadget of gadget.gadgets.values()) {
    cleanDeadRefs(subgadget)
  }
}