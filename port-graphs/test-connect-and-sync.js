// Test the new connect-and-sync command vs regular connect
console.log('Testing connect vs connect-and-sync behavior...')

import { Network, Gadget } from './dist/gadgets.js'

const network = new Network('sync-test')

// Create source gadgets with existing values
const source1 = new Gadget('source-1', network)
const source2 = new Gadget('source-2', network)

source1.receive('control', ['add-output-port', 'data'])
source2.receive('control', ['add-output-port', 'data'])

// Set values directly
source1.getPort('data').value = 'Hello from Source 1!'
source2.getPort('data').value = 'Hello from Source 2!'

// Create target gadgets
const target1 = new Gadget('target-1', network)
const target2 = new Gadget('target-2', network)

target1.receive('control', ['add-input-port', 'input'])
target2.receive('control', ['add-input-port', 'input'])

target1.receive('control', ['set-input-handler', 'input', ['opaque', (self, value) => {
    console.log('🎯 Target 1 received:', value)
}]])
target2.receive('control', ['set-input-handler', 'input', ['opaque', (self, value) => {
    console.log('🎯 Target 2 received:', value)
}]])

network.addGadget(source1)
network.addGadget(source2)
network.addGadget(target1)
network.addGadget(target2)

console.log('\n=== Initial State ===')
console.log('Source 1 value:', source1.getPort('data')?.value)
console.log('Source 2 value:', source2.getPort('data')?.value)
console.log('Target 1 value:', target1.getPort('input')?.value)
console.log('Target 2 value:', target2.getPort('input')?.value)

console.log('\n=== Step 1: Regular Connect (no auto-forward) ===')
source1.receive('control', ['connect', 'data', ['target-1', 'input']])
console.log('✅ Regular connection made')
console.log('Target 1 value after connect:', target1.getPort('input')?.value)

console.log('\n=== Step 2: Connect-and-Sync (with auto-forward) ===')
source2.receive('control', ['connect-and-sync', 'data', ['target-2', 'input']])
console.log('✅ Connect-and-sync completed')
console.log('Target 2 value after connect-and-sync:', target2.getPort('input')?.value)

console.log('\n=== Step 3: Send New Values (both should propagate) ===')
source1.emit('data', 'New message from Source 1!')
source2.emit('data', 'New message from Source 2!')

console.log('\n=== Final State ===')
console.log('Target 1 final value:', target1.getPort('input')?.value)
console.log('Target 2 final value:', target2.getPort('input')?.value)

console.log('\n🎉 Test complete!')
console.log('💡 Regular connect: No auto-forward, only future values propagate')
console.log('💡 Connect-and-sync: Auto-forwards current value + future values propagate')
