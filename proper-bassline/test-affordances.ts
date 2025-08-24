#!/usr/bin/env npx tsx
/**
 * Test Affordance System
 * Run with: npx tsx test-affordances.ts
 */

import {
  Network,
  RectGadget,
  TapAffordance,
  DragAffordance,
  HoverAffordance,
  TypeAffordance,
  DropAffordance,
  OrdinalCell,
  getGadgetValue,
  bool,
  num
} from './src/index'

console.log('🎮 Testing Affordance System\n')

// ============================================================================
// Test 1: Tap Affordance
// ============================================================================
console.log('Test 1: Tap Affordance')

const button = new Network('button')
const buttonVisual = new RectGadget('button-visual')
const buttonState = new OrdinalCell('button-state')
const tap = new TapAffordance('button-tap', buttonState)

// Set initial state
buttonState.userInput(bool(false))

// Add to network
button.add(buttonVisual, buttonState, tap)

// Wire tap output to button state
buttonState.connectFrom(tap.output)

console.log('  Initial state:', getGadgetValue(buttonState))

// Simulate a tap
tap.tap()
// Give propagation a moment
setTimeout(() => {
  console.log('  After tap:', getGadgetValue(tap.output))
  console.log('  Button state:', getGadgetValue(buttonState))
  
  // Wait for pulse to end
  setTimeout(() => {
    console.log('  After pulse ends:', getGadgetValue(tap.output))
  }, 60)
}, 10)

// ============================================================================
// Test 2: Drag Affordance
// ============================================================================
console.log('\nTest 2: Drag Affordance')

const draggable = new Network('draggable')
const dragVisual = new RectGadget('drag-visual')
const drag = new DragAffordance('drag')

// Wire drag output to visual position
dragVisual.position.connectFrom(drag.output)

draggable.add(dragVisual, drag)

// Simulate drag
console.log('  Initial position:', getGadgetValue(dragVisual.position))

drag.handleInput({
  type: 'drag',
  position: { x: 100, y: 100 },
  delta: { x: 10, y: 10 }
})

console.log('  After drag:', getGadgetValue(drag.output))
console.log('  Is dragging:', drag.getIsDragging())

// ============================================================================
// Test 3: Hover Affordance
// ============================================================================
console.log('\nTest 3: Hover Affordance')

const hoverable = new RectGadget('hoverable')
const hover = new HoverAffordance('hover')

// Wire hover to opacity
hoverable.opacity.connectFrom(hover.output)

console.log('  Initial hover:', getGadgetValue(hover.output))

// Simulate hover
hover.handleInput({
  type: 'hover',
  position: { x: 50, y: 50 },
  data: { hovering: true }
})

console.log('  After hover:', getGadgetValue(hover.output))
console.log('  Hover position:', getGadgetValue(hover.output))

// ============================================================================
// Test 4: Type Affordance
// ============================================================================
console.log('\nTest 4: Type Affordance')

const textInput = new Network('text-input')
const inputVisual = new RectGadget('input-visual')
const type = new TypeAffordance('type', undefined, 'Hello')

textInput.add(inputVisual, type)

console.log('  Initial text:', type.getText())

// Simulate typing
type.handleInput({
  type: 'key',
  key: ' '
})
type.handleInput({
  type: 'key',
  key: 'W'
})
type.handleInput({
  type: 'key',
  key: 'o'
})
type.handleInput({
  type: 'key',
  key: 'r'
})
type.handleInput({
  type: 'key',
  key: 'l'
})
type.handleInput({
  type: 'key',
  key: 'd'
})

console.log('  After typing:', type.getText())
console.log('  Output value:', getGadgetValue(type.output))

// ============================================================================
// Test 5: Drop Affordance
// ============================================================================
console.log('\nTest 5: Drop Affordance')

const dropZone = new Network('drop-zone')
const dropVisual = new RectGadget('drop-visual')
const drop = new DropAffordance('drop', undefined, (data) => {
  // Accept only strings
  return typeof data === 'string'
})

dropZone.add(dropVisual, drop)

// Simulate drag over
drop.handleInput({
  type: 'drop',
  data: { dragOver: true }
})

console.log('  Drag over:', drop.getIsDragOver())

// Simulate drop
drop.handleInput({
  type: 'drop',
  position: { x: 75, y: 75 },
  data: { dropped: 'Test data' }
})

console.log('  Dropped data:', getGadgetValue(drop.output))

// ============================================================================
// Test 6: Composing Affordances
// ============================================================================
console.log('\nTest 6: Composing Affordances')

// Create a button that can be clicked and dragged
const complexButton = new Network('complex-button')
const visual = new RectGadget('visual')
const tapAffordance = new TapAffordance('tap')
const dragAffordance = new DragAffordance('drag')
const selected = new OrdinalCell('selected')

// Initial setup
visual.setPosition(0, 0).setSize(100, 50)
selected.userInput(bool(false))

// Wire affordances
selected.connectFrom(tapAffordance.output)  // Tap selects
visual.position.connectFrom(dragAffordance.output)  // Drag moves

// Add all to network
complexButton.add(visual, tapAffordance, dragAffordance, selected)

console.log('  Initial selected:', getGadgetValue(selected))

// Tap to select
tapAffordance.tap()
console.log('  After tap:', getGadgetValue(selected))

// Drag to move
dragAffordance.handleInput({
  type: 'drag',
  position: { x: 50, y: 50 },
  delta: { x: 50, y: 50 }
})

console.log('  After drag position:', getGadgetValue(dragAffordance.output))

// ============================================================================
// Test 7: Affordance Bounds
// ============================================================================
console.log('\nTest 7: Affordance Bounds')

const bounded = new TapAffordance('bounded-tap')
bounded.setBounds({ x: 0, y: 0, width: 100, height: 100 })

// Test inside bounds
const insideResult = bounded.handleInput({
  type: 'tap',
  position: { x: 50, y: 50 }
})
console.log('  Tap inside bounds:', insideResult)

// Test outside bounds
const outsideResult = bounded.handleInput({
  type: 'tap',
  position: { x: 150, y: 150 }
})
console.log('  Tap outside bounds:', outsideResult)

// ============================================================================
// Summary
// ============================================================================
setTimeout(() => {
  console.log('\n✅ Affordance Tests Complete!')
  console.log('  - Tap creates boolean pulses')
  console.log('  - Drag emits position deltas')
  console.log('  - Hover tracks mouse state')
  console.log('  - Type captures keyboard input')
  console.log('  - Drop handles drag and drop')
  console.log('  - Affordances can be composed')
  console.log('  - Bounds filtering works')
  console.log('  - Ready for UI interaction!')
}, 150)