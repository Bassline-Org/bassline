/**
 * Propagation engine with strength-based argmax resolution
 */

import { Signal, Contact, Gadget } from './types'
import { HYSTERESIS_UNITS, shouldPropagate } from './strength'

// ============================================================================
// Configuration
// ============================================================================

export const HYSTERESIS = HYSTERESIS_UNITS  // In strength units (100 = 0.01)

// ============================================================================
// Core propagation
// ============================================================================

/**
 * Propagate a signal to a contact using argmax with contradiction detection
 */
export function propagate(contact: Contact, signal: Signal): void {
  // If we're in a transaction, batch this update instead of executing immediately
  if (isInTransaction) {
    pendingUpdates.push([contact, signal])
    return
  }
  if (!contact) {
    return
  }
  
  // Check if the contact's gadget is still alive
  const gadgetCheck = contact.gadget?.deref()
  
  // Cap infinite or invalid strength values
  const cappedSignal = {
    value: signal.value,
    strength: isFinite(signal.strength) ? Math.min(signal.strength, 10000000) : 10000  // Raised cap to 10M
  }
  
  // Compare strengths
  if (cappedSignal.strength > contact.signal.strength) {
    // Stronger signal wins
    contact.signal = cappedSignal
  } else if (signal.strength === contact.signal.strength) {
    // Equal strength - check for contradiction
    if (signal.value !== contact.signal.value) {
      // Different values at same strength = contradiction
      // Contradiction detected
      contact.signal = {
        value: { 
          tag: 'contradiction', 
          value: `Conflict: ${JSON.stringify(contact.signal.value)} vs ${JSON.stringify(signal.value)}` 
        },
        strength: signal.strength
      }
    }
    // Same value, same strength = no change (already there)
    return
  } else {
    // Weaker signal - ignore
    return
  }
  
  // Check if this contact belongs to a gadget that needs to compute
  // BUT only if this is an INPUT contact (outputs shouldn't trigger compute)
  const gadget = contact.gadget.deref()
  if (gadget?.compute && contact.direction === 'input') {
    // Gather all input signals
    const inputs = gatherInputs(gadget)
    
    // For primitive gadgets, only compute if all inputs have values
    // EXCEPT for trigger-based gadgets - they can compute if trigger is set
    if (gadget.primitive) {
      // Check if this is a trigger-based gadget (has a 'trigger' input)
      const triggerInput = inputs.get('trigger')
      const isTriggerBased = triggerInput !== undefined
      
      if (isTriggerBased) {
        // For trigger-based gadgets, only compute when trigger is true
        // Other inputs can use defaults if not set
        if (!triggerInput || triggerInput.value !== true) {
          return // Don't compute unless triggered
        }
        // If triggered, compute regardless of other input states
      } else {
        // For non-trigger gadgets, require all inputs to have values
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
// Batch propagation and transactions
// ============================================================================

// Transaction state
let isInTransaction = false
let pendingUpdates: Array<[Contact, Signal]> = []

/**
 * Start a transaction - all propagations will be batched until commit
 */
export function beginTransaction(): void {
  isInTransaction = true
  pendingUpdates = []
}

/**
 * Commit the current transaction - execute all batched propagations
 */
export function commitTransaction(): void {
  if (!isInTransaction) return
  
  isInTransaction = false
  const updates = [...pendingUpdates]
  pendingUpdates = []
  
  // Execute all updates in sequence
  for (const [contact, signal] of updates) {
    propagate(contact, signal)
  }
}

/**
 * Rollback the current transaction - discard all batched propagations
 */
export function rollbackTransaction(): void {
  isInTransaction = false
  pendingUpdates = []
}

/**
 * Execute a function within a transaction
 */
export function withTransaction<T>(fn: () => T): T {
  beginTransaction()
  try {
    const result = fn()
    commitTransaction()
    return result
  } catch (error) {
    rollbackTransaction()
    throw error
  }
}

/**
 * Check if currently in a transaction
 */
export function inTransaction(): boolean {
  return isInTransaction
}

/**
 * Set multiple contacts at once, useful for initialization
 */
export function setContacts(updates: Array<[Contact, Signal]>): void {
  if (isInTransaction) {
    // If in transaction, batch all updates
    pendingUpdates.push(...updates)
  } else {
    // Otherwise propagate immediately
    for (const [contact, signal] of updates) {
      propagate(contact, signal)
    }
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