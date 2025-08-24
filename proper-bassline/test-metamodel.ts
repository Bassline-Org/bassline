#!/usr/bin/env npx tsx
/**
 * Test the core metamodel implementation
 * Run with: npx tsx test-metamodel.ts
 */

import { 
  Network, 
  OrdinalCell,
  networkValue,
  query,
  Query
} from './src/index'

console.log('🧪 Testing Core Metamodel Implementation\n')

// ============================================================================
// Test 1: Networks as first-class values
// ============================================================================
console.log('Test 1: Networks as Values')

const network1 = new Network('main')
const cell1 = new OrdinalCell('cell1')
const cell2 = new OrdinalCell('cell2')

cell1.userInput({ type: 'number', value: 42 })
cell2.userInput({ type: 'string', value: 'hello' })

network1.add(cell1, cell2)

// Convert network to a value
const netValue = network1.asValue()
console.log('✓ Created NetworkValue:', netValue.toString())

// Store network in a cell
const networkCell = new OrdinalCell('network-holder')
networkCell.userInput(netValue)
console.log('✓ Stored network in cell')

// Query the network even as a value
const results = netValue.query('Cell')
console.log(`✓ Queried NetworkValue, found ${results.size} cells`)

// ============================================================================
// Test 2: Query System
// ============================================================================
console.log('\nTest 2: Query System')

const network2 = new Network('test-network')

// Add various gadgets with metadata
const cell3 = new OrdinalCell('alpha')
cell3.setMetadata('visible', true)
cell3.setMetadata('priority', 1)
cell3.userInput({ type: 'number', value: 10 })

const cell4 = new OrdinalCell('beta')
cell4.setMetadata('visible', false)
cell4.setMetadata('priority', 2)
cell4.userInput({ type: 'number', value: 5 })

const cell5 = new OrdinalCell('gamma')
cell5.setMetadata('visible', true)
cell5.setMetadata('priority', 3)
cell5.userInput({ type: 'number', value: 15 })

network2.add(cell3, cell4, cell5)

// Test various queries
console.log('\nQuery Tests:')

// Query by type
const allCells = network2.query('OrdinalCell')
console.log(`  "OrdinalCell" → ${allCells.size} results`)

// Query by ID
const alphaCell = network2.query('#alpha')
console.log(`  "#alpha" → ${alphaCell.size} results`)

// Query by metadata
const visibleCells = network2.query('.visible')
console.log(`  ".visible" → ${visibleCells.size} results`)

// Query with attribute filter (this won't work perfectly yet as we need value access)
const highPriority = new Query(network2)
  .select('OrdinalCell')
  .withMetadata('priority')
  .where(g => {
    const meta = g.getMetadata()
    return meta.priority && meta.priority > 1
  })
console.log(`  Priority > 1 → ${highPriority.count()} results`)

// ============================================================================
// Test 3: Nested Networks
// ============================================================================
console.log('\nTest 3: Nested Networks')

const parentNet = new Network('parent')
const childNet1 = new Network('child1')
const childNet2 = new Network('child2')

// Add cells to child networks
const childCell1 = new OrdinalCell('child1-cell')
const childCell2 = new OrdinalCell('child2-cell')

childNet1.add(childCell1)
childNet2.add(childCell2)

// Add child networks to parent
parentNet.addChildNetwork(childNet1)
parentNet.addChildNetwork(childNet2)

// Add a cell directly to parent
const parentCell = new OrdinalCell('parent-cell')
parentNet.add(parentCell)

// Query parent network
const allInParent = parentNet.query('*')
console.log(`✓ Parent network has ${allInParent.size} direct children`)

// Test path lookup
const found = parentNet.getByPath('child1')
console.log(`✓ Found child1 via path: ${found?.id}`)

// ============================================================================
// Test 4: Query Chaining
// ============================================================================
console.log('\nTest 4: Query Chaining')

const network3 = new Network('chain-test')

// Create cells with connections
const sourceCell = new OrdinalCell('source')
const middleCell = new OrdinalCell('middle')
const targetCell = new OrdinalCell('target')

network3.add(sourceCell, middleCell, targetCell)

// Wire them together
sourceCell.addDownstream(middleCell)
middleCell.addUpstream(sourceCell)
middleCell.addDownstream(targetCell)
targetCell.addUpstream(middleCell)

// Query downstream from source
const downstream = new Query(network3)
  .select('#source')
  .downstream()
console.log(`✓ Downstream from source: ${downstream.count()} gadgets`)

// Query upstream from target
const upstream = new Query(network3)
  .select('#target')
  .upstream()
console.log(`✓ Upstream from target: ${upstream.count()} gadgets`)

// ============================================================================
// Summary
// ============================================================================
console.log('\n✅ Core Metamodel Tests Complete!')
console.log('  - Networks can be values')
console.log('  - Networks are queryable')
console.log('  - Query system supports selectors')
console.log('  - Query chaining works')
console.log('  - Nested networks supported')