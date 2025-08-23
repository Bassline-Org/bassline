/**
 * Test round-trip serialization and deserialization
 */

import { Network } from './src/network'
import { OrdinalCell, MaxCell } from './src/cells/basic'
import { VisualNode } from './src/visual-node'
import { globalRegistry } from './src/registry'
import { num } from './src/types'
import { ExtractValue } from './src/functions/extract'

console.log('=== Creating Original Network ===')

// Create a network with some cells and connections
const network = new Network('test-network')

// Create cells
const input1 = new OrdinalCell('input1')
const input2 = new OrdinalCell('input2')
const extract1 = new ExtractValue('extract1')
const extract2 = new ExtractValue('extract2')
const max = new MaxCell('max-value')

// Set values
input1.userInput(num(10))
input2.userInput(num(20))

// Connect them through extractors
extract1.connectFrom('input', input1)
extract2.connectFrom('input', input2)
max.connectFrom(extract1)
max.connectFrom(extract2)

// Compute to get initial values
extract1.compute()
extract2.compute()
max.compute()

// Add to network
network.add(input1, input2, extract1, extract2, max)

// Create a visual node
const visualNode = new VisualNode('visual1', max)
visualNode.setPosition(100, 200)
visualNode.setSize(150, 100)
network.add(visualNode)

console.log('Original network state:')
console.log('- input1:', input1.getOutput())
console.log('- input2:', input2.getOutput())
console.log('- max:', max.getOutput())
console.log('- visual position:', visualNode.position.getOutput())

// Serialize
console.log('\n=== Serializing ===')
const serialized = network.serialize()
console.log('Serialized successfully')

// Deserialize
console.log('\n=== Deserializing ===')
const deserialized = globalRegistry.deserialize(serialized) as Network

if (!deserialized) {
  console.error('Failed to deserialize!')
  process.exit(1)
}

console.log('Deserialized successfully')

// Find gadgets in deserialized network
const newInput1 = Array.from(deserialized.gadgets).find(g => g.id === 'input1') as OrdinalCell
const newInput2 = Array.from(deserialized.gadgets).find(g => g.id === 'input2') as OrdinalCell
const newMax = Array.from(deserialized.gadgets).find(g => g.id === 'max-value') as MaxCell
const newVisual = Array.from(deserialized.gadgets).find(g => g.id === 'visual1') as VisualNode

console.log('\nDeserialized network state:')
console.log('- input1:', newInput1?.getOutput())
console.log('- input2:', newInput2?.getOutput())
console.log('- max:', newMax?.getOutput())
console.log('- visual position:', newVisual?.position?.getOutput())

// Test that connections work
console.log('\n=== Testing Propagation ===')
console.log('Changing input1 to 30...')
newInput1?.userInput(num(30))

// The max cell needs to compute to pull from its inputs
newMax?.compute()

console.log('After propagation:')
console.log('- input1:', newInput1?.getOutput())
console.log('- input2:', newInput2?.getOutput())
console.log('- max (should be 30):', newMax?.getOutput())

// Test visual node
console.log('\n=== Testing Visual Node ===')
console.log('Moving visual node to (300, 400)...')
newVisual?.setPosition(300, 400)
console.log('New position:', newVisual?.position?.getOutput())

// Verify connections
console.log('\n=== Verifying Connections ===')
const maxSources = newMax?.getLiveSources()
console.log('Max cell has', maxSources?.length, 'sources')
console.log('Sources:', maxSources?.map(s => s.id))

console.log('\n✅ Round-trip test complete!')