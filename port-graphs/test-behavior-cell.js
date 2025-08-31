// Test the BehaviorCell for creating prototypes and instances
console.log('Testing BehaviorCell: Prototype → Instance pattern...')

// Import the built modules
import { Network, Gadget, BehaviorCell } from './dist/gadgets.js'

// Create network
const network = new Network('behavior-test')

// Create a behavior cell to store prototypes
const behaviorCell = new BehaviorCell('behavior-library', network)
network.addGadget(behaviorCell)

console.log('\n=== Step 1: Define Behavior Prototypes ===')

// Define a "display gadget" behavior prototype
behaviorCell.receive('define-behavior', ['display-gadget', [
    ['add-input-port', 'input'],
    ['add-output-port', 'output'],
    ['set-input-handler', 'input', ['opaque', (self, value) => {
        console.log('📺 Display received:', value)
        self.emit('output', value)
    }]]
]])

// Define a "adder gadget" behavior prototype
behaviorCell.receive('define-behavior', ['adder-gadget', [
    ['add-input-port', 'a'],
    ['add-input-port', 'b'],
    ['add-output-port', 'sum'],
    ['set-input-handler', 'a', ['opaque', (self, value) => {
        const aVal = self.getPort('a')?.value
        const bVal = self.getPort('b')?.value
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            self.emit('sum', aVal + bVal)
        }
    }]],
    ['set-input-handler', 'b', ['opaque', (self, value) => {
        const aVal = self.getPort('a')?.value
        const bVal = self.getPort('b')?.value
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            self.emit('sum', aVal + bVal)
        }
    }]]
]])

console.log('✅ Behavior prototypes defined!')

console.log('\n=== Step 2: Create Gadget Instances ===')

// Create empty gadgets that will receive behaviors
const display1 = new Gadget('display-1', network)
const display2 = new Gadget('display-2', network)
const adder1 = new Gadget('adder-1', network)

network.addGadget(display1)
network.addGadget(display2)
network.addGadget(adder1)

console.log('✅ Empty gadgets created!')

console.log('\n=== Step 3: Load Behaviors into Instances ===')

// Load the display behavior into both display gadgets
behaviorCell.receive('load-behavior', ['display-gadget', 'display-1'])
behaviorCell.receive('load-behavior', ['display-gadget', 'display-2'])

// Load the adder behavior into the adder gadget
behaviorCell.receive('load-behavior', ['adder-gadget', 'adder-1'])

console.log('✅ Behaviors loaded into instances!')

console.log('\n=== Step 4: Test the Instances ===')

// Test display gadgets
console.log('\n--- Testing Display Gadgets ---')
display1.receive('input', 'Hello from Display 1!')
display2.receive('input', 'Hello from Display 2!')

// Test adder gadget
console.log('\n--- Testing Adder Gadget ---')
adder1.receive('a', 5)
adder1.receive('b', 3)

console.log('\n🎉 BehaviorCell prototype → instance pattern working!')

// Show what behaviors are available
console.log('\n📚 Available behaviors:', behaviorCell.listBehaviors())
