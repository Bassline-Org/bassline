/**
 * Demonstration of the linear additive strength system
 */

import {
  createTransistor,
  createGainMinter,
  propagate,
  signal,
  toUnits,
  formatStrength,
  KILL_SIGNAL,
  STRENGTH_BASE
} from '../src'

function demo() {
  console.log('Linear Additive Strength System\n')
  console.log('=' .repeat(50))
  
  // Test 1: Negative control (attenuation - always allowed)
  console.log('\nTest 1: Free Attenuation (negative control)')
  {
    const transistor = createTransistor('atten')
    const input = transistor.contacts.get('input')!
    const control = transistor.contacts.get('control')!
    const output = transistor.contacts.get('output')!
    
    propagate(input, signal(42, 0.8))  // 8000 units
    
    // Reduce by 3000 units (0.3)
    propagate(control, signal(-3000, 1.0))
    
    console.log(`Input: ${input.signal.strength} units (${formatStrength(input.signal.strength)})`)
    console.log(`Control: ${control.signal.value} units (reduce by ${formatStrength(Math.abs(control.signal.value as number))})`)
    console.log(`Output: ${output.signal.strength} units (${formatStrength(output.signal.strength)})`)
    console.log(`Expected: 5000 units (8000 - 3000)`)
  }
  
  // Test 2: Positive control without gain (should not amplify)
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 2: Amplification Without Gain')
  {
    const transistor = createTransistor('no-gain')
    const input = transistor.contacts.get('input')!
    const control = transistor.contacts.get('control')!
    const output = transistor.contacts.get('output')!
    
    console.log(`Gain pool: ${transistor.gainPool} units`)
    
    propagate(input, signal('data', 0.5))  // 5000 units
    propagate(control, signal(3000, 1.0))  // Try to boost by 3000
    
    console.log(`Input: ${input.signal.strength} units`)
    console.log(`Control: ${control.signal.value} units (wants to boost)`)
    console.log(`Output: ${output.signal.strength} units (no amplification)`)
  }
  
  // Test 3: Positive control with gain
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 3: Amplification With Gain')
  {
    const transistor = createTransistor('with-gain')
    const input = transistor.contacts.get('input')!
    const control = transistor.contacts.get('control')!
    const output = transistor.contacts.get('output')!
    
    // Add gain
    transistor.gainPool = 5000  // 0.5 worth of gain
    console.log(`Gain pool: ${transistor.gainPool} units`)
    
    propagate(input, signal('data', 0.4))  // 4000 units
    propagate(control, signal(3000, 1.0))  // Boost by 3000
    
    console.log(`Input: ${input.signal.strength} units`)
    console.log(`Control: ${control.signal.value} units`)
    console.log(`Output: ${output.signal.strength} units`)
    console.log(`Expected: 7000 units (4000 + 3000)`)
    console.log(`Remaining gain: ${transistor.gainPool} units`)
  }
  
  // Test 4: Kill signal
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 4: Kill Signal (Emergency Mute)')
  {
    const transistor = createTransistor('killable')
    const input = transistor.contacts.get('input')!
    const control = transistor.contacts.get('control')!
    const output = transistor.contacts.get('output')!
    
    propagate(input, signal('important', 0.9))  // 9000 units
    console.log(`Initial output: ${output.signal.strength} units`)
    
    // Send kill signal
    propagate(control, signal(KILL_SIGNAL, 1.0))
    
    console.log(`After KILL_SIGNAL: ${output.signal.strength} units (muted)`)
    console.log(`Value preserved: ${output.signal.value}`)
  }
  
  // Test 5: Gradual drowning with linear adjustments
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 5: Path Competition via Linear Adjustment')
  {
    const pathA = createTransistor('path-a')
    const pathB = createTransistor('path-b')
    
    // Give path B gain for boosting
    pathB.gainPool = 10000  // 1.0 worth of gain
    
    const inA = pathA.contacts.get('input')!
    const inB = pathB.contacts.get('input')!
    const ctrlA = pathA.contacts.get('control')!
    const ctrlB = pathB.contacts.get('control')!
    const outA = pathA.contacts.get('output')!
    const outB = pathB.contacts.get('output')!
    
    // Both start equal
    propagate(inA, signal('A', 0.5))  // 5000 units
    propagate(inB, signal('B', 0.5))  // 5000 units
    propagate(ctrlA, signal(0, 1.0))  // No adjustment
    propagate(ctrlB, signal(0, 1.0))  // No adjustment
    
    console.log('Initial:')
    console.log(`  Path A: ${outA.signal.strength} units`)
    console.log(`  Path B: ${outB.signal.strength} units`)
    
    // Gradually boost B to drown out A
    console.log('\nBoosting B:')
    propagate(ctrlB, signal(1000, 1.1))  // +1000 units
    console.log(`  B +1000: ${outB.signal.strength} units`)
    
    propagate(ctrlB, signal(3000, 1.2))  // +3000 units
    console.log(`  B +3000: ${outB.signal.strength} units`)
    
    // Attenuate A (no gain needed)
    console.log('\nAttenuating A:')
    propagate(ctrlA, signal(-2000, 1.3))  // -2000 units
    console.log(`  A -2000: ${outA.signal.strength} units`)
    
    console.log(`\nFinal: B (${outB.signal.strength}) beats A (${outA.signal.strength})`)
    console.log(`Path B gain remaining: ${pathB.gainPool} units`)
  }
  
  // Test 6: Gain minting still works
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 6: Gain Minting')
  {
    const transistor = createTransistor('mintable')
    const minter = createGainMinter('minter')
    ;(minter as any).registerTarget(transistor)
    
    const amount = minter.contacts.get('amount')!
    const validator = minter.contacts.get('validator')!
    const target = minter.contacts.get('target')!
    const success = minter.contacts.get('success')!
    
    console.log(`Initial gain: ${transistor.gainPool}`)
    
    // Mint 7500 units (0.75) of gain
    propagate(amount, signal(7500, 1.0))
    propagate(validator, signal(true, 1.0))
    propagate(target, signal('mintable', 1.0))
    
    console.log(`After minting: ${transistor.gainPool} units`)
    console.log(`Success: ${success.signal.value}`)
  }
  
  console.log('\n' + '=' .repeat(50))
  console.log('\nLinear system test complete!')
}

demo()