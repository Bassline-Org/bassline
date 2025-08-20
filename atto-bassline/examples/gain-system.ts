/**
 * Demonstration of the gain allocation and amplification system
 */

import {
  createGadget,
  createContact,
  createSignal,
  wire,
  propagate,
  createTransistor,
  createGainMinter,
  createAdder,
  createGreaterThan
} from '../src'

import { getAllReceipts } from '../src/receipts'

function runGainExample() {
  console.log('Atto-Bassline Gain System Example\n')
  console.log('=' .repeat(50))
  
  // Test 1: Basic transistor amplification with gain
  console.log('\nTest 1: Transistor Amplification')
  {
    const transistor = createTransistor('amp-1')
    const input = transistor.contacts.get('input')!
    const control = transistor.contacts.get('control')!
    const output = transistor.contacts.get('output')!
    
    // Initially, transistor has no gain
    console.log(`Initial gain pool: ${transistor.gainPool}`)
    
    // Try to amplify without gain (should fail)
    propagate(input, createSignal(42, 0.5))
    propagate(control, createSignal(1.5, 0.8))  // Try 1.5x amplification
    console.log(`Without gain: output strength = ${output.signal.strength} (expected 0.5)`)
    
    // Manually add gain for testing
    transistor.gainPool = 1.0
    console.log(`\nAdded 1.0 gain to pool`)
    
    // Now amplification should work
    propagate(control, createSignal(1.5, 0.9))  // Force update with higher strength
    console.log(`With gain: output strength = ${output.signal.strength} (expected 0.75)`)
    console.log(`Remaining gain: ${transistor.gainPool} (expected 0.5)`)
  }
  
  // Test 2: Gain minting with validation
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 2: Gain Minting with Validation')
  {
    const transistor = createTransistor('amp-2')
    const minter = createGainMinter('minter-1')
    
    // Register the transistor with the minter
    ;(minter as any).registerTarget(transistor)
    
    const amount = minter.contacts.get('amount')!
    const validator = minter.contacts.get('validator')!
    const target = minter.contacts.get('target')!
    const success = minter.contacts.get('success')!
    const receipt = minter.contacts.get('receipt')!
    
    console.log(`Initial transistor gain: ${transistor.gainPool}`)
    
    // Try to mint without validation (should fail)
    propagate(amount, createSignal(2.0, 1.0))
    propagate(validator, createSignal(false, 1.0))
    propagate(target, createSignal('amp-2', 1.0))
    console.log(`Mint without validation: success = ${success.signal.value}`)
    console.log(`Transistor gain after failed mint: ${transistor.gainPool}`)
    
    // Mint with validation (should succeed)
    propagate(validator, createSignal(true, 1.2))  // Override with true
    console.log(`\nMint with validation: success = ${success.signal.value}`)
    console.log(`Transistor gain after successful mint: ${transistor.gainPool}`)
    
    // Now the transistor can amplify
    const input = transistor.contacts.get('input')!
    const control = transistor.contacts.get('control')!
    const output = transistor.contacts.get('output')!
    
    propagate(input, createSignal(10, 0.3))
    propagate(control, createSignal(2.5, 1.0))  // 2.5x amplification needs 1.5 gain
    console.log(`\nAmplified signal: strength = ${output.signal.strength} (expected 0.75)`)
    console.log(`Remaining gain: ${transistor.gainPool} (expected 0.5)`)
  }
  
  // Test 3: Validation circuit for earned amplification
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 3: Earned Amplification Circuit')
  {
    // Create a performance metric (simulated)
    const performanceGadget = createAdder('perf-adder')
    const threshold = createGreaterThan('threshold')
    const minter = createGainMinter('earn-minter')
    const amplifier = createTransistor('earn-amp')
    
    // Register amplifier with minter
    ;(minter as any).registerTarget(amplifier)
    
    // Wire up validation circuit:
    // performance > threshold → validator
    const perfA = performanceGadget.contacts.get('a')!
    const perfB = performanceGadget.contacts.get('b')!
    const perfOut = performanceGadget.contacts.get('output')!
    
    const threshA = threshold.contacts.get('a')!
    const threshB = threshold.contacts.get('b')!
    const threshOut = threshold.contacts.get('output')!
    
    wire(perfOut, threshA)
    
    // Connect threshold output to minter validator
    const minterValidator = minter.contacts.get('validator')!
    const minterAmount = minter.contacts.get('amount')!
    const minterTarget = minter.contacts.get('target')!
    const minterSuccess = minter.contacts.get('success')!
    
    wire(threshOut, minterValidator)
    
    // Set up the circuit
    propagate(perfA, createSignal(3, 1.0))
    propagate(perfB, createSignal(2, 1.0))  // Performance = 5
    propagate(threshB, createSignal(4, 1.0))  // Threshold = 4
    propagate(minterAmount, createSignal(0.5, 1.0))  // Mint 0.5 gain if valid
    propagate(minterTarget, createSignal('earn-amp', 1.0))
    
    console.log(`Performance: ${perfOut.signal.value}`)
    console.log(`Threshold check: ${threshOut.signal.value}`)
    console.log(`Minting success: ${minterSuccess.signal.value}`)
    console.log(`Amplifier gain earned: ${amplifier.gainPool}`)
    
    // Now the amplifier can boost signals
    const ampInput = amplifier.contacts.get('input')!
    const ampControl = amplifier.contacts.get('control')!
    const ampOutput = amplifier.contacts.get('output')!
    
    propagate(ampInput, createSignal('earned', 0.6))
    propagate(ampControl, createSignal(1.3, 1.0))  // 1.3x amplification
    console.log(`\nEarned amplification: strength = ${ampOutput.signal.strength}`)
  }
  
  // Test 4: Gradual path drowning
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 4: Gradual Path Drowning')
  {
    const pathA = createTransistor('path-a')
    const pathB = createTransistor('path-b')
    const merger = createGadget('merger')
    const mergeContact = createContact('merge', merger)
    merger.contacts.set('merge', mergeContact)
    
    // Wire both paths to merger
    const outA = pathA.contacts.get('output')!
    const outB = pathB.contacts.get('output')!
    wire(outA, mergeContact)
    wire(outB, mergeContact)
    
    // Give pathB some gain to work with
    pathB.gainPool = 2.0
    
    // Both paths start equal
    const inA = pathA.contacts.get('input')!
    const inB = pathB.contacts.get('input')!
    const ctrlA = pathA.contacts.get('control')!
    const ctrlB = pathB.contacts.get('control')!
    
    propagate(inA, createSignal('A', 0.5))
    propagate(inB, createSignal('B', 0.5))
    propagate(ctrlA, createSignal(1.0, 1.0))  // Pass through
    propagate(ctrlB, createSignal(1.0, 1.0))  // Pass through
    
    console.log(`Initial state:`)
    console.log(`  Path A: value=${outA.signal.value}, strength=${outA.signal.strength}`)
    console.log(`  Path B: value=${outB.signal.value}, strength=${outB.signal.strength}`)
    console.log(`  Merger: value=${mergeContact.signal.value} (winner by argmax)`)
    
    // Gradually boost pathB to drown out pathA
    console.log(`\nBoosting path B gradually:`)
    
    propagate(ctrlB, createSignal(1.2, 1.1))  // 1.2x
    console.log(`  B at 1.2x: strength=${outB.signal.strength}, merger=${mergeContact.signal.value}`)
    
    propagate(ctrlB, createSignal(1.5, 1.2))  // 1.5x
    console.log(`  B at 1.5x: strength=${outB.signal.strength}, merger=${mergeContact.signal.value}`)
    
    console.log(`  Path B gain remaining: ${pathB.gainPool}`)
  }
  
  // Show all receipts
  console.log('\n' + '=' .repeat(50))
  console.log('\nGain Usage Receipts:')
  const receipts = getAllReceipts()
  for (const receipt of receipts) {
    console.log(`  ${receipt.gadgetId}: ${receipt.amount} gain - ${receipt.reason}`)
  }
  
  console.log('\n' + '=' .repeat(50))
  console.log('\nGain system demonstration complete!')
}

// Run the example
runGainExample()