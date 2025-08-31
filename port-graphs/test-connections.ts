import { Network, Gadget, Cell } from './src/gadgets'
import { Term } from './src/terms'

// Simple test to verify connections work
console.log('Testing connection system...')

// Create network
const network = new Network('test-network')

// Create a simple cell that just passes through values
const passThrough = new Cell('pass-through', network, {}, (current, incoming) => incoming)

// Create a display gadget that logs values
const display = new Gadget('display', network)
display.receive('control', ['add-input-port', 'input1'])
display.receive('control', ['set-input-handler', 'input1', ['opaque', (self, value) => {
    console.log('Display received:', value)
}]])

// Connect the cell output to the display input
passThrough.receive('control', ['connect', 'value-out', ['display', 'input1']])

// Test the connection
console.log('Sending value through the network...')
passThrough.receive('value-in', 'Hello, World!')

console.log('Connection test complete!')
