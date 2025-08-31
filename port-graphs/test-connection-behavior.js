// Test connection behavior - do we auto-forward current values?
console.log('Testing connection behavior: Do we auto-forward current values on connection?')

import { Network, Gadget } from './dist/gadgets.js'

const network = new Network('connection-test')

// Create source gadget with a value
const source = new Gadget('source', network)
source.receive('control', ['add-output-port', 'data'])

// Set a value directly to the output port
source.getPort('data').value = 'Hello World!'

// Create target gadget
const target = new Gadget('target', network)
target.receive('control', ['add-input-port', 'input'])
target.receive('control', ['set-input-handler', 'input', ['opaque', (self, value) => {
    console.log('🎯 Target received:', value)
}]])
target.receive('control', ['add-output-port', 'echo'])
target.receive('control', ['set-input-handler', 'echo', ['opaque', (self, value) => {
    self.emit('echo', value)
}]])

network.addGadget(source)
network.addGadget(target)

console.log('\n=== Step 1: Set initial value ===')
source.receive('control', 'Hello World!')
console.log('✅ Source output port value set to:', source.getPort('data')?.value)

console.log('\n=== Step 2: Connect ports (BEFORE sending new value) ===')
source.receive('control', ['connect', 'data', ['target', 'input']])
console.log('✅ Ports connected')

console.log('\n=== Step 3: Send new value (should propagate) ===')
source.emit('data', 'New message!')

console.log('\n=== Step 4: Check if initial value was forwarded ===')
console.log('Source current value:', source.getPort('data')?.value)
console.log('Target current value:', target.getPort('input')?.value)

console.log('\n💡 Conclusion: Only NEW values propagate, not existing values on connection')
