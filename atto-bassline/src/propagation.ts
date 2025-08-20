/**
 * Propagation engine with strength-based argmax resolution
 */

import { Signal, Contact, Gadget } from './types'
import { HYSTERESIS_UNITS, overcomesHysteresis } from './strength'

// ============================================================================
// Configuration
// ============================================================================

export const HYSTERESIS = HYSTERESIS_UNITS  // In strength units (100 = 0.01)

// ============================================================================
// Core propagation
// ============================================================================

/**
 * Propagate a signal to a contact using argmax with hysteresis
 */
export function propagate(contact: Contact, signal: Signal): void {
  // Argmax with hysteresis: only update if new signal is stronger
  if (!overcomesHysteresis(signal.strength, contact.signal.strength)) {
    return  // No change, signal not strong enough
  }
  
  // Update the contact's signal
  contact.signal = signal
  
  // Check if this contact belongs to a gadget that needs to compute
  const gadget = contact.gadget.deref()
  if (gadget?.compute) {
    // Gather all input signals
    const inputs = gatherInputs(gadget)
    
    // For primitive gadgets, only compute if all inputs have values
    if (gadget.primitive) {
      let allInputsReady = true
      for (const [name, inputSignal] of inputs) {
        // Get the actual contact to check direction
        const inputContact = gadget.contacts.get(name)
        
        // Skip output contacts
        if (inputContact?.direction === 'output') continue
        
        // Check if input has a real value (not null and has strength)
        if (inputSignal.value === null || inputSignal.strength === 0) {
          allInputsReady = false
          break
        }
      }
      
      if (!allInputsReady) {
        return // Don't compute yet, wait for all inputs
      }
    }
    
    // Compute outputs
    const outputs = gadget.compute(inputs)
    
    // Propagate outputs (force update for computed outputs)
    for (const [name, outputSignal] of outputs) {
      const outputContact = gadget.contacts.get(name)
      if (outputContact) {
        // For computed outputs, always update (no hysteresis check)
        outputContact.signal = outputSignal
        
        // Forward to targets
        for (const targetRef of outputContact.targets) {
          const target = targetRef.deref()
          if (target) {
            propagate(target, outputSignal)
          }
        }
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
    // For primitive gadgets, gather the signal's value not the signal itself
    inputs.set(name, contact.signal)
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