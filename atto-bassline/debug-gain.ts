import { 
  createTransistor,
  createSignal,
  propagate
} from './src'

const transistor = createTransistor('test')
const input = transistor.contacts.get('input')!
const control = transistor.contacts.get('control')!
const output = transistor.contacts.get('output')!

console.log('Initial state:')
console.log('- Input:', input.signal)
console.log('- Control:', control.signal)
console.log('- Output:', output.signal)
console.log('- Gain pool:', transistor.gainPool)

console.log('\nPropagating input signal...')
propagate(input, createSignal(42, 0.8))
console.log('- Input:', input.signal)
console.log('- Output:', output.signal)

console.log('\nPropagating control signal (0.5 attenuation)...')
propagate(control, createSignal(0.5, 1.0))
console.log('- Control:', control.signal)
console.log('- Output:', output.signal)
console.log('Expected output strength: 0.4 (0.8 * 0.5)')

console.log('\nTrying with both inputs at once...')
const trans2 = createTransistor('test2')
const in2 = trans2.contacts.get('input')!
const ctrl2 = trans2.contacts.get('control')!
const out2 = trans2.contacts.get('output')!

// Set both inputs
propagate(in2, createSignal(100, 0.6))
propagate(ctrl2, createSignal(0.5, 0.8))

console.log('Output after both inputs:', out2.signal)