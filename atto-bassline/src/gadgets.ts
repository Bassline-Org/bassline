/**
 * Special gadgets for strength manipulation
 */

import { Gadget, Signal, createGadget, createContact, createSignal } from './types'
import { createReceipt } from './receipts'

// ============================================================================
// Transistor: Attenuates signal strength
// ============================================================================

export function createTransistor(id: string, defaultAttenuation = 0.9): Gadget {
  const transistor = createGadget(id)
  
  // Define compute function
  transistor.compute = (inputs) => {
    const input = inputs.get('input')
    const control = inputs.get('control')
    
    if (!input) {
      return new Map([['output', createSignal()]])
    }
    
    // Use control value as attenuation factor, or default
    const factor = (control?.value as number) ?? defaultAttenuation
    
    // Output same value with attenuated strength
    return new Map([
      ['output', {
        value: input.value,
        strength: input.strength * factor
      }]
    ])
  }
  
  // Create contacts
  transistor.contacts.set('input', createContact('input', transistor))
  transistor.contacts.set('control', createContact('control', transistor))
  transistor.contacts.set('output', createContact('output', transistor))
  
  return transistor
}

// ============================================================================
// Modulator: Boosts signal strength (requires receipts)
// ============================================================================

export function createModulator(id: string): Gadget {
  const modulator = createGadget(id)
  
  // Define compute function
  modulator.compute = (inputs) => {
    const input = inputs.get('input')
    const boost = inputs.get('boost')
    
    if (!input || !boost) {
      return new Map([['output', createSignal()]])
    }
    
    const boostAmount = boost.value as number ?? 0
    
    // Create receipt for audit trail
    if (boostAmount > 0) {
      createReceipt(id, boostAmount, 'Signal amplification')
    }
    
    // Output same value with boosted strength (capped at 1.0)
    return new Map([
      ['output', {
        value: input.value,
        strength: Math.min(1.0, input.strength + boostAmount)
      }]
    ])
  }
  
  // Create contacts
  modulator.contacts.set('input', createContact('input', modulator))
  modulator.contacts.set('boost', createContact('boost', modulator))
  modulator.contacts.set('output', createContact('output', modulator))
  
  return modulator
}

// ============================================================================
// Helper for creating primitive gadgets with MIN strength
// ============================================================================

export function createPrimitiveGadget(
  id: string,
  computeValue: (inputs: Map<string, unknown>) => unknown,
  inputNames: string[] = ['a', 'b'],
  outputNames: string[] = ['output']
): Gadget {
  const gadget = createGadget(id)
  gadget.primitive = true
  
  // Define compute function with MIN strength principle
  gadget.compute = (inputs) => {
    // Extract values and find minimum strength
    const values = new Map<string, unknown>()
    let minStrength = Infinity
    let hasInputs = false
    
    for (const [name, signal] of inputs) {
      if (inputNames.includes(name)) {
        values.set(name, signal.value)
        if (signal.strength > 0) {  // Only count inputs with actual strength
          minStrength = Math.min(minStrength, signal.strength)
          hasInputs = true
        }
      }
    }
    
    if (!hasInputs) {
      // No inputs, return empty signal
      const outputs = new Map<string, Signal>()
      for (const outputName of outputNames) {
        outputs.set(outputName, createSignal())
      }
      return outputs
    }
    
    // Compute new value
    const outputValue = computeValue(values)
    
    // Output uses MINIMUM strength (information loss principle)
    const outputs = new Map<string, Signal>()
    outputs.set(outputNames[0], {
      value: outputValue,
      strength: minStrength
    })
    
    return outputs
  }
  
  // Create input contacts
  for (const inputName of inputNames) {
    gadget.contacts.set(inputName, createContact(inputName, gadget))
  }
  
  // Create output contacts
  for (const outputName of outputNames) {
    gadget.contacts.set(outputName, createContact(outputName, gadget))
  }
  
  return gadget
}