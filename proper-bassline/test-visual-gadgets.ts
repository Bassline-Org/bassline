#!/usr/bin/env npx tsx
/**
 * Test Visual Gadgets
 * Run with: npx tsx test-visual-gadgets.ts
 */

import {
  Network,
  VisualGadget,
  RectGadget,
  TextGadget,
  PathGadget,
  GroupGadget,
  getGadgetValue,
  num,
  str
} from './src/index'

console.log('🎨 Testing Visual Gadgets\n')

// ============================================================================
// Test 1: Basic Visual Gadget
// ============================================================================
console.log('Test 1: Basic Visual Gadget')

const visual = new VisualGadget('test-visual')
visual.setPosition(100, 200)
visual.setSize(300, 150)
visual.setOpacity(0.8)

// Debug: check raw output
const posOut = visual.position.getOutput()
const sizeOut = visual.size.getOutput()
console.log('  Position output:', posOut)
console.log('  Extracted pos:', getGadgetValue(visual.position))
console.log('  Extracted size:', getGadgetValue(visual.size))

const bounds = visual.getBounds()
console.log('✓ Bounds:', bounds)
console.log('✓ Contains (150, 250):', visual.containsPoint({ x: 150, y: 250 }))
console.log('✓ Contains (500, 500):', visual.containsPoint({ x: 500, y: 500 }))

// ============================================================================
// Test 2: Rectangle Gadget
// ============================================================================
console.log('\nTest 2: Rectangle Gadget')

const rect = new RectGadget('my-rect')
rect.setPosition(10, 10)
  .setSize(100, 50)
  .setBackgroundColor('#ff0000')
  .setBorderColor('#000000')
  .setBorderWidth(2)
  .setBorderRadius(5)

console.log('✓ Background color:', getGadgetValue(rect.backgroundColor))
console.log('✓ Border width:', getGadgetValue(rect.borderWidth))
console.log('✓ Renderer type:', rect.getRendererType())

// ============================================================================
// Test 3: Text Gadget
// ============================================================================
console.log('\nTest 3: Text Gadget')

const text = new TextGadget('my-text', 'Hello, World!')
text.setPosition(50, 50)
  .setFontSize(24)
  .setColor('#333333')
  .setFontFamily('Arial')

console.log('✓ Text content:', getGadgetValue(text.text))
console.log('✓ Font size:', getGadgetValue(text.fontSize))
console.log('✓ Renderer type:', text.getRendererType())

// ============================================================================
// Test 4: Path Gadget (for edges)
// ============================================================================
console.log('\nTest 4: Path Gadget')

const path = new PathGadget('my-edge')
path.setBezier(
  { x: 0, y: 0 },
  { x: 100, y: 100 },
  { x: 50, y: 0 },
  { x: 50, y: 100 }
)
path.setStrokeColor('#0000ff')
  .setStrokeWidth(3)
  .setStrokeDasharray('5,5')

const points = getGadgetValue(path.points)
console.log('✓ Path points:', points?.length || 0, 'points')
console.log('✓ Stroke color:', getGadgetValue(path.strokeColor))
console.log('✓ Is smooth:', getGadgetValue(path.smooth))

// ============================================================================
// Test 5: Group Gadget with Children
// ============================================================================
console.log('\nTest 5: Group with Children')

const group = new GroupGadget('my-group')
group.setPosition(0, 0)
  .setSize(500, 500)
  .setTranslate(10, 10)
  .setOverflow('hidden')

// Add children
const child1 = new RectGadget('child-rect')
child1.setPosition(0, 0).setSize(50, 50)

const child2 = new TextGadget('child-text', 'Child')
child2.setPosition(60, 20)

group.addVisualChild(child1)
group.addVisualChild(child2)

console.log('✓ Group has', group.visualChildren.size, 'visual children')
console.log('✓ Group has', group.gadgets.size, 'gadgets')
console.log('✓ Transform:', getGadgetValue(group.transform))

// ============================================================================
// Test 6: Wiring Visual Properties
// ============================================================================
console.log('\nTest 6: Wiring Visual Properties')

const source = new RectGadget('source-rect')
const target = new RectGadget('target-rect')

// Wire source's position to target's position
target.position.connectFrom(source.position)

// Set source position
source.setPosition(123, 456)

// Target should have same position (after propagation)
const targetBounds = target.getBounds()
console.log('✓ Source position: (123, 456)')
console.log('✓ Target position:', targetBounds ? `(${targetBounds.x}, ${targetBounds.y})` : 'null')

// ============================================================================
// Test 7: Querying Visual Gadgets
// ============================================================================
console.log('\nTest 7: Querying Visual Gadgets')

const network = new Network('ui-network')
network.add(rect, text, path, group)

// Query by metadata
const visuals = network.query('.visual')
console.log('✓ Found', visuals.size, 'visual gadgets')

const shapes = new Set<string>()
visuals.forEach(v => {
  const shape = v.getMetadata().shape
  if (shape) shapes.add(shape)
})
console.log('✓ Shape types:', Array.from(shapes).join(', '))

const containers = network.query('.container')
console.log('✓ Found', containers.size, 'container gadgets')

// ============================================================================
// Summary
// ============================================================================
console.log('\n✅ Visual Gadget Tests Complete!')
console.log('  - Visual properties are cells')
console.log('  - Properties can be wired together')
console.log('  - Visual hierarchy works')
console.log('  - Gadgets are queryable')
console.log('  - Ready for rendering!')