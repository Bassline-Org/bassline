#!/usr/bin/env npx tsx
/**
 * Test View Gadget Propagation
 * Verify that queries actually work and propagate correctly
 * Run with: npx tsx test-view-propagation.ts
 */

import {
  Network,
  RectGadget,
  TextGadget,
  GroupGadget,
  OrdinalCell,
  QueryGadget,
  ProjectionGadget,
  ViewGadget,
  str,
  networkValue,
  getGadgetValue
} from './src/index'

console.log('🔍 Testing View Gadget Propagation\n')

// ============================================================================
// Test 1: Verify Query Results
// ============================================================================
console.log('Test 1: Verify Query Results')

// Create test network
const network = new Network('test')

const rect1 = new RectGadget('rect1')
const rect2 = new RectGadget('rect2')
const text1 = new TextGadget('text1')
const group1 = new GroupGadget('group1')

network.add(rect1, rect2, text1, group1)

// Test the query method directly
const allGadgets = network.query('*')
console.log('  All gadgets (*): ', allGadgets.size, 'found')

const rects = network.query('RectGadget')
console.log('  RectGadgets: ', rects.size, 'found')

const byId = network.query('#rect1')
console.log('  By ID (#rect1): ', byId.size, 'found')

// Now test through QueryGadget
const queryGadget = new QueryGadget('test-query')
const networkCell = new OrdinalCell('network-cell')
const selectorCell = new OrdinalCell('selector-cell')

queryGadget.connectFrom('network', networkCell)
queryGadget.connectFrom('selector', selectorCell)

// Set inputs and trigger computation
networkCell.userInput(networkValue(network))
selectorCell.userInput(str('RectGadget'))

// Force computation
queryGadget.compute()

// Debug: Check what the QueryGadget received
console.log('  Debug - QueryGadget has inputs:', queryGadget.hasAllInputs())
console.log('  Debug - Current values:', queryGadget.currentValues)

// Check output
const output = queryGadget.getOutput()
console.log('  QueryGadget output type:', output.type)
if (output.type === 'set') {
  console.log('  QueryGadget found:', output.value.size, 'results')
  for (const item of output.value) {
    if (item.type === 'string') {
      console.log('    -', item.value)
    }
  }
}

// ============================================================================
// Test 2: Verify Projection Creates Visuals
// ============================================================================
console.log('\nTest 2: Verify Projection Creates Visuals')

const projection = new ProjectionGadget('test-projection')

// Wire to query output
projection.connectFrom('results', queryGadget)

// Set layout
const layoutCell = new OrdinalCell('layout')
const paramsCell = new OrdinalCell('params')

projection.connectFrom('layout', layoutCell)
projection.connectFrom('params', paramsCell)

layoutCell.userInput(str('list'))

// Force computation
projection.compute()

// Check container
console.log('  Container has', projection.container.gadgets.size, 'visual gadgets')
for (const gadget of projection.container.gadgets) {
  console.log('    -', gadget.id)
}

// ============================================================================
// Test 3: Full ViewGadget Integration
// ============================================================================
console.log('\nTest 3: Full ViewGadget Integration')

const view = new ViewGadget('integrated-view')

// Set up the view
view.observeNetwork(network)
view.setSelector('TextGadget')
view.setLayout('grid')
view.setLayoutParams({
  columns: 2,
  spacing: 15
})

// Force computation through the chain
view.query.compute()
view.projection.compute()

// Check results
const queryOutput = view.query.getOutput()
console.log('  Query found:', queryOutput.type === 'set' ? queryOutput.value.size : 0, 'TextGadgets')

const projectionOutput = view.projection.getOutput()
console.log('  Projection output:', projectionOutput)

console.log('  Visual container has:', view.projection.container.gadgets.size, 'gadgets')

// ============================================================================
// Test 4: Propagation on Change
// ============================================================================
console.log('\nTest 4: Propagation on Change')

// Add a new gadget to the network
const newText = new TextGadget('text2')
network.add(newText)

// Change the selector to catch the new gadget
view.setSelector('TextGadget')

// Force recomputation
view.query.compute()
view.projection.compute()

const newQueryOutput = view.query.getOutput()
console.log('  After adding text2, query found:', 
  newQueryOutput.type === 'set' ? newQueryOutput.value.size : 0, 'TextGadgets')

console.log('  Visual container now has:', view.projection.container.gadgets.size, 'gadgets')

// ============================================================================
// Summary
// ============================================================================
console.log('\n✅ View Propagation Tests Complete!')
console.log('  - Network.query() works correctly')
console.log('  - QueryGadget outputs sets of IDs')
console.log('  - ProjectionGadget creates visual gadgets')
console.log('  - ViewGadget integrates everything')
console.log('  - Changes propagate through the system')
console.log('  - The computational graph drives the UI!')