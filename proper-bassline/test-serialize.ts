import { Network } from './src/network'
import { OrdinalCell } from './src/cells/basic'
import { VisualNode } from './src/visual-node'

// Create a test network
const network = new Network('test-network')

// Add some cells
const cell1 = new OrdinalCell('cell1')
const cell2 = new OrdinalCell('cell2')

cell1.userInput({ type: 'number', value: 42 })
cell2.connectFrom(cell1)

network.add(cell1, cell2)

// Test with VisualNode
const visualNode = new VisualNode('visual1', cell1)
visualNode.setPosition(100, 200)
visualNode.setSize(150, 100)

network.add(visualNode)

// Serialize everything
const serialized = network.serialize()
console.log('Network serialization:')
console.log(JSON.stringify(serialized, null, 2))

console.log('\n\nVisualNode serialization:')
console.log(JSON.stringify(visualNode.serialize(), null, 2))