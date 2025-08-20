import { 
  createTransistor,
  propagate,
  signal,
  KILL_SIGNAL
} from './src'

const transistor = createTransistor('test')
const input = transistor.contacts.get('input')!
const control = transistor.contacts.get('control')!
const output = transistor.contacts.get('output')!

console.log('Debug Linear System\n')

// Set input
propagate(input, signal(42, 0.8))
console.log('After input:')
console.log('  Input:', input.signal)
console.log('  Control:', control.signal)
console.log('  Output:', output.signal)

// Try negative control
console.log('\nTrying negative control (-3000):')
propagate(control, signal(-3000, 1.0))
console.log('  Control:', control.signal)
console.log('  Output:', output.signal)

// Try with stronger signal to overcome hysteresis
console.log('\nTrying with stronger control signal:')
propagate(control, signal(-3000, 1.5))
console.log('  Control:', control.signal)
console.log('  Output:', output.signal)