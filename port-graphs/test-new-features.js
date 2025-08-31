// Test the new batch operations and FunctionGadget
console.log('Testing new features: batch operations and FunctionGadget...')

// Import the built modules
import { Network, Gadget, Cell, FunctionGadget } from './dist/gadgets.js'

// Create network
const network = new Network('test-network')

// Test 1: Batch operations with regular Gadget
console.log('\n=== Test 1: Batch Operations ===')
const testGadget = new Gadget('test-gadget', network)

// Use batch to set up multiple ports at once
testGadget.receive('control', ['batch', [
    ['add-input-port', 'input1'],
    ['add-input-port', 'input2'],
    ['add-output-port', 'output1'],
    ['set-input-handler', 'input1', ['opaque', (self, value) => {
        console.log('Input1 received:', value)
    }]],
    ['set-input-handler', 'input2', ['opaque', (self, value) => {
        console.log('Input2 received:', value)
    }]]
]])

console.log('✅ Batch operations completed!')

// Test 2: FunctionGadget auto-setup
console.log('\n=== Test 2: FunctionGadget ===')
const adder = new FunctionGadget('adder', network, {
    inputs: ['a', 'b'],
    outputs: ['sum'],
    fn: (inputs) => {
        console.log('Function executing with inputs:', inputs)
        return (inputs.a || 0) + (inputs.b || 0)
    }
})

// Add gadgets to network
network.addGadget(testGadget)
network.addGadget(adder)

// Create a display gadget to receive the output
const display = new Gadget('display', network)
display.receive('control', ['add-input-port', 'result'])
display.receive('control', ['set-input-handler', 'result', ['opaque', (self, value) => {
    console.log('🎯 Display received result:', value)
}]])
network.addGadget(display)

// Connect adder output to display input
adder.receive('control', ['connect', 'sum', ['display', 'result']])

console.log('✅ FunctionGadget created with auto-setup and connected to display!')

// Test 3: Test the function execution and output propagation
console.log('\n=== Test 3: Function Execution & Output ===')
console.log('Sending values to adder...')

// Send first input
adder.receive('a', 5)
console.log('Sent a = 5')

// Send second input (should trigger function execution)
adder.receive('b', 3)
console.log('Sent b = 3')

// Check if output port has the result
const outputPort = adder.getPort('sum')
if (outputPort) {
    console.log('✅ Output port value:', outputPort.value)
} else {
    console.log('❌ Output port not found')
}

console.log('\n🎉 All tests completed!')
