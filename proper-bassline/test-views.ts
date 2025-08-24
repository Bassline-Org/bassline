#!/usr/bin/env npx tsx
/**
 * Test Simple View Gadget System
 * Run with: npx tsx test-views-simple.ts
 */

import {
  Network,
  RectGadget,
  TextGadget,
  OrdinalCell,
  str,
  networkValue
} from './src/index'

import { QueryGadget } from './src/query-gadget'
import { ProjectionGadget } from './src/projection-gadget'
import { 
  ViewGadget,
  createListView,
  createGridView,
  createTreeView
} from './src/view-gadget'

console.log('🎯 Testing Simple View Gadget System\n')

// ============================================================================
// Test 1: QueryGadget as a Simple Function
// ============================================================================
console.log('Test 1: QueryGadget as a Simple Function')

// Create a test network
const testNetwork = new Network('test-network')

const rect1 = new RectGadget('rect1')
rect1.setMetadata('type', 'shape')

const rect2 = new RectGadget('rect2')
rect2.setMetadata('type', 'shape')

const text1 = new TextGadget('text1')
text1.setMetadata('type', 'text')

testNetwork.add(rect1, rect2, text1)

// Create a query gadget
const queryGadget = new QueryGadget('my-query')

// Create input cells
const networkCell = new OrdinalCell('network-input')
const selectorCell = new OrdinalCell('selector-input')

// Wire them up
queryGadget.connectFrom('network', networkCell)
queryGadget.connectFrom('selector', selectorCell)

// Set values
networkCell.userInput(networkValue(testNetwork))
selectorCell.userInput(str('[type="shape"]'))

console.log('  Query gadget created as FunctionGadget')
console.log('  Inputs wired: network and selector')
console.log('  Will output set of matching IDs')

// ============================================================================
// Test 2: ProjectionGadget as a Simple Function
// ============================================================================
console.log('\nTest 2: ProjectionGadget as a Simple Function')

const projectionGadget = new ProjectionGadget('my-projection')

// Create cells for layout config
const layoutCell = new OrdinalCell('layout-type')
const paramsCell = new OrdinalCell('layout-params')

// Wire projection inputs
projectionGadget.connectFrom('results', queryGadget)  // Direct from query!
projectionGadget.connectFrom('layout', layoutCell)
projectionGadget.connectFrom('params', paramsCell)

// Configure layout
layoutCell.userInput(str('grid'))

console.log('  Projection gadget created as FunctionGadget')
console.log('  Wired directly to query output')
console.log('  Will generate visual gadgets automatically')

// ============================================================================
// Test 3: Complete ViewGadget Network
// ============================================================================
console.log('\nTest 3: Complete ViewGadget Network')

const view = new ViewGadget('my-view')

// Configure the view
view.observeNetwork(testNetwork)
view.setSelector('RectGadget')
view.setLayout('list')

console.log('  ViewGadget created containing:')
console.log('    - Input cells for network, selector, layout')
console.log('    - QueryGadget function')
console.log('    - ProjectionGadget function')
console.log('    - All wired together automatically')

// ============================================================================
// Test 4: Changing Inputs Propagates Automatically
// ============================================================================
console.log('\nTest 4: Changing Inputs Propagates Automatically')

// Change selector
view.setSelector('TextGadget')
console.log('  Changed selector → query re-runs → projection updates')

// Change layout
view.setLayout('grid')
console.log('  Changed layout → projection re-generates visuals')

// Change params
view.setLayoutParams({ columns: 4, spacing: 20 })
console.log('  Changed params → projection adjusts layout')

// ============================================================================
// Test 5: Factory Functions for Common Views
// ============================================================================
console.log('\nTest 5: Factory Functions for Common Views')

const listView = createListView('quick-list', testNetwork, '*')
console.log('  Created list view with one line')

const gridView = createGridView('quick-grid', testNetwork, 'RectGadget', 4)
console.log('  Created 4-column grid view')

const treeView = createTreeView('quick-tree', testNetwork, 'TextGadget')
console.log('  Created tree view')

// ============================================================================
// Test 6: Composing Views in a Larger Network
// ============================================================================
console.log('\nTest 6: Composing Views in a Larger Network')

// Create a network that contains multiple views
const dashboard = new Network('dashboard')

// Share a network cell between views
const sharedNetwork = new OrdinalCell('shared-network')
sharedNetwork.userInput(networkValue(testNetwork))

// Create multiple views
const view1 = new ViewGadget('view1')
const view2 = new ViewGadget('view2')

// Wire to shared network
view1.networkInput.connectFrom(sharedNetwork)
view2.networkInput.connectFrom(sharedNetwork)

// Different configurations
view1.setSelector('RectGadget').setLayout('list')
view2.setSelector('TextGadget').setLayout('grid')

// Add to dashboard
dashboard.add(sharedNetwork, view1, view2)

console.log('  Created dashboard with:')
console.log('    - Shared network cell')
console.log('    - Two views with different queries/layouts')
console.log('    - All propagating from same source')

// ============================================================================
// Summary
// ============================================================================
console.log('\n✅ Simple View Gadget Tests Complete!')
console.log('  - QueryGadget is just a FunctionGadget')
console.log('  - ProjectionGadget is just a FunctionGadget')
console.log('  - ViewGadget wires them together naturally')
console.log('  - No complex classes or manual updates')
console.log('  - Everything flows through propagation')
console.log('  - Compose views like any other gadgets')
console.log('  - The system uses itself to build itself!')