import { 
  createTransistor,
  createGadget,
  createContact,
  propagate,
  signal,
  wire,
  formatStrength
} from './src'

console.log('Debug Trust Gate\n')

const trustGate = createTransistor('trust')
const input = trustGate.contacts.get('input')!
const control = trustGate.contacts.get('control')!
const output = trustGate.contacts.get('output')!

// Create receiver
const network = createGadget('network')
const networkIn = createContact('data', network)
network.contacts.set('data', networkIn)
wire(output, networkIn)

console.log('Initial state:')
console.log('  Input:', input.signal)
console.log('  Control:', control.signal)
console.log('  Output:', output.signal)
console.log('  Network:', networkIn.signal)

console.log('\nSetting input to 1.0:')
propagate(input, signal('data', 1.0))
console.log('  Input:', formatStrength(input.signal.strength))
console.log('  Output:', formatStrength(output.signal.strength))
console.log('  Network:', formatStrength(networkIn.signal.strength))

console.log('\nApplying -9000 control (reduce by 90%):')
propagate(control, signal(-9000, 1.0))
console.log('  Control:', control.signal.value)
console.log('  Output:', formatStrength(output.signal.strength))
console.log('  Network:', formatStrength(networkIn.signal.strength))
console.log('  Expected network: 0.1 (1000 units)')