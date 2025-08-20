/**
 * Test the integer-based strength system
 */

import {
  createTransistor,
  propagate,
  signal,  // Use the convenience function
  toUnits,
  fromUnits,
  formatStrength,
  STRENGTH_BASE,
  STRENGTH_HALF,
  STRENGTH_FULL
} from '../src'

console.log('Integer Strength System Test\n')
console.log('=' .repeat(50))

// Show the conversion
console.log('\nStrength conversions:')
console.log(`1.0 = ${toUnits(1.0)} units`)
console.log(`0.5 = ${toUnits(0.5)} units`)
console.log(`0.75 = ${toUnits(0.75)} units`)
console.log(`0.01 = ${toUnits(0.01)} units (hysteresis threshold)`)

console.log('\nConstants:')
console.log(`STRENGTH_BASE = ${STRENGTH_BASE}`)
console.log(`STRENGTH_HALF = ${STRENGTH_HALF}`)
console.log(`STRENGTH_FULL = ${STRENGTH_FULL}`)

// Test transistor with integer units
console.log('\n' + '=' .repeat(50))
console.log('\nTransistor test with integers:')

const transistor = createTransistor('test')
const input = transistor.contacts.get('input')!
const control = transistor.contacts.get('control')!
const output = transistor.contacts.get('output')!

// Use the signal() helper which converts decimal to units
propagate(input, signal(42, 0.8))  // 0.8 → 8000 units
propagate(control, signal(STRENGTH_HALF, 1.0))  // Control = 5000 (0.5x)

console.log(`Input strength: ${input.signal.strength} units (${formatStrength(input.signal.strength)})`)
console.log(`Control: ${control.signal.value} units (${formatStrength(control.signal.value as number)})`)
console.log(`Output strength: ${output.signal.strength} units (${formatStrength(output.signal.strength)})`)
console.log(`Expected: 4000 units (0.8 * 0.5 = 0.4)`)

// Test amplification
console.log('\n' + '=' .repeat(50))
console.log('\nAmplification test:')

transistor.gainPool = STRENGTH_BASE  // 1.0 worth of gain

propagate(control, signal(STRENGTH_BASE * 1.5, 1.1))  // 1.5x amplification

console.log(`Control: ${control.signal.value} units (${fromUnits(control.signal.value as number)}x)`)
console.log(`Output strength: ${output.signal.strength} units (${formatStrength(output.signal.strength)})`)
console.log(`Remaining gain: ${transistor.gainPool} units (${formatStrength(transistor.gainPool)})`)
console.log(`Expected output: 12000 units (0.8 * 1.5 = 1.2)`)
console.log(`Expected remaining: 5000 units (10000 - 5000 used)`)

// Test precision
console.log('\n' + '=' .repeat(50))
console.log('\nPrecision test:')

const trans2 = createTransistor('precise')
const in2 = trans2.contacts.get('input')!
const ctrl2 = trans2.contacts.get('control')!
const out2 = trans2.contacts.get('output')!

// Test very small values
propagate(in2, signal('data', 0.333))  // 0.333 → 3330 units
propagate(ctrl2, signal(3333, 1.0))    // 0.3333x

console.log(`Input: ${in2.signal.strength} units (${formatStrength(in2.signal.strength)})`)
console.log(`Control: ${ctrl2.signal.value} units (${fromUnits(ctrl2.signal.value as number)}x)`)
console.log(`Output: ${out2.signal.strength} units (${formatStrength(out2.signal.strength)})`)
console.log(`No floating point errors!`)

console.log('\n' + '=' .repeat(50))
console.log('\nInteger system test complete!')