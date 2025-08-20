/**
 * Special gadgets for strength manipulation
 */

import { Gadget, Signal, Value, createGadget, createContact, createSignal } from './types'
import { createReceipt } from './receipts'
import { KILL_SIGNAL, adjustStrength } from './strength'

// ============================================================================
// Transistor: Attenuates or amplifies signal strength
// ============================================================================

export function createTransistor(id: string, defaultControl = 0): Gadget {
  const transistor = createGadget(id)
  
  // Define compute function using additive model
  // Negative control = attenuation (always allowed)
  // Positive control = amplification (requires gain)
  // KILL_SIGNAL = complete mute
  transistor.compute = (inputs: Map<string, Signal>) => {
    const input = inputs.get('input')
    const control = inputs.get('control')
    
    if (!input) {
      return new Map([['output', createSignal()]])
    }
    
    // Control value is additive adjustment in strength units
    const controlValue = (control?.value as number) ?? defaultControl
    
    // Special case: kill signal
    if (controlValue === KILL_SIGNAL) {
      return new Map([
        ['output', {
          value: input.value,
          strength: 0  // Complete mute
        }]
      ])
    }
    
    // Negative control: attenuation (always allowed)
    if (controlValue <= 0) {
      const outputStrength = adjustStrength(input.strength, controlValue)
      return new Map([
        ['output', {
          value: input.value,
          strength: outputStrength
        }]
      ])
    }
    
    // Positive control: amplification (requires gain)
    const availableGain = transistor.gainPool
    const actualBoost = Math.min(controlValue, availableGain)
    
    if (actualBoost > 0) {
      transistor.gainPool -= actualBoost
      createReceipt(id, actualBoost, `Amplification: consumed ${actualBoost} units`)
    }
    
    const outputStrength = adjustStrength(input.strength, actualBoost)
    return new Map([
      ['output', {
        value: input.value,
        strength: outputStrength
      }]
    ])
  }
  
  // Create contacts
  transistor.contacts.set('input', createContact('input', transistor, undefined, 'input'))
  transistor.contacts.set('control', createContact('control', transistor, undefined, 'input'))
  transistor.contacts.set('output', createContact('output', transistor, undefined, 'output'))
  
  return transistor
}

// ============================================================================
// GainMinter: Mints gain to a target gadget when validated
// ============================================================================

export function createGainMinter(id: string): Gadget {
  const minter = createGadget(id)
  minter.primitive = true
  
  // Store references to target gadgets
  const targetGadgets = new Map<string, WeakRef<Gadget>>()
  
  // Define compute function
  minter.compute = (inputs) => {
    const amount = inputs.get('amount')
    const validator = inputs.get('validator')
    const targetId = inputs.get('target')
    
    // Check if we should mint
    if (!amount || !validator || !targetId) {
      return new Map([
        ['success', createSignal(false, 1.0)],
        ['receipt', createSignal(null, 1.0)]
      ])
    }
    
    // Validator must be true to mint
    if (validator.value !== true) {
      return new Map([
        ['success', createSignal(false, validator.strength)],
        ['receipt', createSignal(null, validator.strength)]
      ])
    }
    
    // Amount is in strength units
    const mintAmount = amount.value as number
    const targetGadgetId = targetId.value as string
    
    if (typeof mintAmount !== 'number' || mintAmount <= 0) {
      return new Map([
        ['success', createSignal(false, amount.strength)],
        ['receipt', createSignal(null, amount.strength)]
      ])
    }
    
    // Find target gadget
    let targetGadget: Gadget | undefined
    const cachedRef = targetGadgets.get(targetGadgetId)
    if (cachedRef) {
      targetGadget = cachedRef.deref()
    }
    
    // If not cached or expired, search for it
    if (!targetGadget) {
      // This is a simplified search - in real system would need proper registry
      // For now, we'll return failure if we can't find the gadget
      return new Map([
        ['success', createSignal(false, 1.0)],
        ['receipt', createSignal(`Target gadget ${targetGadgetId} not found`, 1.0)]
      ])
    }
    
    // Mint the gain (does not trigger propagation automatically)
    // The transistor will only recompute if it was previously gain-limited
    targetGadget.gainPool += mintAmount
    
    // Create receipt
    const receipt = createReceipt(targetGadgetId, mintAmount, `Gain minted by ${id}`)
    
    // Use minimum strength of inputs
    const outputStrength = Math.min(amount.strength, validator.strength, targetId.strength)
    
    return new Map([
      ['success', createSignal(true, outputStrength)],
      ['receipt', createSignal(receipt as any, outputStrength)]  // Receipt as Value
    ])
  }
  
  // Add method to register target gadgets
  ;(minter as any).registerTarget = (gadget: Gadget) => {
    targetGadgets.set(gadget.id, new WeakRef(gadget))
  }
  
  // Create contacts
  minter.contacts.set('amount', createContact('amount', minter))
  minter.contacts.set('validator', createContact('validator', minter))
  minter.contacts.set('target', createContact('target', minter))
  minter.contacts.set('success', createContact('success', minter, undefined, 'output'))
  minter.contacts.set('receipt', createContact('receipt', minter, undefined, 'output'))
  
  return minter
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
    let minStrength = Number.MAX_SAFE_INTEGER
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
      value: outputValue as Value,
      strength: minStrength
    })
    
    return outputs
  }
  
  // Create input contacts
  for (const inputName of inputNames) {
    gadget.contacts.set(inputName, createContact(inputName, gadget, undefined, 'input'))
  }
  
  // Create output contacts
  for (const outputName of outputNames) {
    gadget.contacts.set(outputName, createContact(outputName, gadget, undefined, 'output'))
  }
  
  return gadget
}