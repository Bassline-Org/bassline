#!/usr/bin/env npx tsx
/**
 * Example: UI as Gadgets Concept
 * 
 * This demonstrates how UI elements will be gadgets in the propagation network,
 * with properties as cells that can be wired and computed.
 * 
 * Run with: npx tsx example-ui-concept.ts
 */

import { 
  Network, 
  OrdinalCell,
  Cell,
  FunctionGadget,
  Query,
  num,
  str,
  bool,
  getGadgetValue
} from './src/index'

console.log('🎨 UI as Gadgets - Concept Demo\n')

// ============================================================================
// Simulated Visual Gadget (what we'll build next)
// ============================================================================
class MockVisualGadget extends Network {
  // Visual properties as cells
  position: OrdinalCell
  size: OrdinalCell
  visible: OrdinalCell
  opacity: OrdinalCell
  
  constructor(id: string) {
    super(id)
    
    // Create visual property cells
    this.position = new OrdinalCell(`${id}-position`)
    this.size = new OrdinalCell(`${id}-size`)
    this.visible = new OrdinalCell(`${id}-visible`)
    this.opacity = new OrdinalCell(`${id}-opacity`)
    
    // Set defaults
    this.position.userInput({ type: 'object', value: { x: 0, y: 0 } })
    this.size.userInput({ type: 'object', value: { width: 100, height: 50 } })
    this.visible.userInput(bool(true))
    this.opacity.userInput(num(1.0))
    
    // Add to network
    this.add(this.position, this.size, this.visible, this.opacity)
  }
  
  render(): string {
    const pos = getGadgetValue(this.position)
    const size = getGadgetValue(this.size)
    const vis = getGadgetValue(this.visible)
    const opacity = getGadgetValue(this.opacity)
    
    if (vis === false) return ''
    
    return `[${this.id}] at (${pos?.x || 0}, ${pos?.y || 0}) size: ${size?.width || 100}x${size?.height || 50} opacity: ${opacity || 1}`
  }
}

// ============================================================================
// Example: Button as a Network of Gadgets
// ============================================================================
console.log('Example 1: Button as Gadget Network')

class ButtonGadget extends MockVisualGadget {
  label: OrdinalCell
  pressed: OrdinalCell
  enabled: OrdinalCell
  
  constructor(id: string, label: string) {
    super(id)
    
    // Button-specific properties
    this.label = new OrdinalCell(`${id}-label`)
    this.pressed = new OrdinalCell(`${id}-pressed`)
    this.enabled = new OrdinalCell(`${id}-enabled`)
    
    // Set defaults
    this.label.userInput(str(label))
    this.pressed.userInput(bool(false))
    this.enabled.userInput(bool(true))
    
    // Add to network
    this.add(this.label, this.pressed, this.enabled)
  }
  
  // Simulate a click
  click(): void {
    const enabled = getGadgetValue(this.enabled)
    
    if (enabled !== false) {
      const label = getGadgetValue(this.label)
      console.log(`  🖱️  Clicked: ${label}`)
      this.pressed.userInput(bool(true))
      // In real implementation, TapAffordance would handle this
    }
  }
}

const button = new ButtonGadget('submit-btn', 'Submit')
console.log('✓ Created button:', button.render())

// ============================================================================
// Example: Wiring Properties Together
// ============================================================================
console.log('\nExample 2: Wiring Properties')

// Create two buttons
const button1 = new ButtonGadget('btn1', 'Enable')
const button2 = new ButtonGadget('btn2', 'Target')

// Wire button1's pressed state to button2's enabled state
// When button1 is pressed, button2 becomes enabled
button2.enabled.connectFrom(button1.pressed)

console.log('Initial state:')
console.log('  Button 1 pressed:', getGadgetValue(button1.pressed))
console.log('  Button 2 enabled:', getGadgetValue(button2.enabled))

// Click button 1
button1.click()

// No need to propagate - it should be automatic!

console.log('\nAfter clicking button 1:')
console.log('  Button 1 pressed:', getGadgetValue(button1.pressed))
console.log('  Button 2 enabled:', getGadgetValue(button2.enabled))

// ============================================================================
// Example: Computed Properties
// ============================================================================
console.log('\nExample 3: Computed Properties')

// Create a slider-like gadget
class SliderGadget extends MockVisualGadget {
  value: OrdinalCell
  min: OrdinalCell
  max: OrdinalCell
  
  constructor(id: string) {
    super(id)
    
    this.value = new OrdinalCell(`${id}-value`)
    this.min = new OrdinalCell(`${id}-min`)
    this.max = new OrdinalCell(`${id}-max`)
    
    this.min.userInput(num(0))
    this.max.userInput(num(100))
    this.value.userInput(num(50))
    
    this.add(this.value, this.min, this.max)
  }
}

// Create a progress bar whose width is computed from slider value
class ProgressBarGadget extends MockVisualGadget {
  progress: OrdinalCell
  
  constructor(id: string) {
    super(id)
    
    this.progress = new OrdinalCell(`${id}-progress`)
    this.progress.userInput(num(0))
    this.add(this.progress)
  }
  
  render(): string {
    const prog = getGadgetValue(this.progress) || 0
    const width = Math.floor(prog / 5) // Scale to 20 chars
    const bar = '█'.repeat(width) + '░'.repeat(20 - width)
    return `[${bar}] ${prog}%`
  }
}

const slider = new SliderGadget('volume')
const progressBar = new ProgressBarGadget('volume-display')

// Wire slider value to progress bar
progressBar.progress.connectFrom(slider.value)

// The connection should pull the initial value automatically
console.log('Slider at 50:')
console.log('  ', progressBar.render())

// Change slider - should auto-propagate
slider.value.userInput(num(75))

console.log('\nSlider at 75:')
console.log('  ', progressBar.render())

// Try 100%
slider.value.userInput(num(100))

console.log('\nSlider at 100:')
console.log('  ', progressBar.render())

// ============================================================================
// Example: UI Chrome as Network
// ============================================================================
console.log('\nExample 4: UI Chrome as Modifiable Network')

class ToolbarGadget extends Network {
  tools: Set<MockVisualGadget> = new Set()
  
  constructor() {
    super('toolbar')
    
    // Position and layout properties
    const position = new OrdinalCell('toolbar-position')
    const layout = new OrdinalCell('toolbar-layout')
    
    position.userInput({ type: 'object', value: { x: 0, y: 0 } })
    layout.userInput(str('horizontal'))
    
    this.add(position, layout)
  }
  
  addTool(tool: MockVisualGadget): void {
    this.tools.add(tool)
    this.add(tool)
    console.log(`  + Added ${tool.id} to toolbar`)
  }
  
  removeTool(tool: MockVisualGadget): void {
    this.tools.delete(tool)
    this.remove(tool)
    console.log(`  - Removed ${tool.id} from toolbar`)
  }
}

// Create default toolbar
const toolbar = new ToolbarGadget()

// Users can modify the toolbar!
const selectTool = new ButtonGadget('select-tool', '↖ Select')
const wireTool = new ButtonGadget('wire-tool', '⚡ Wire')
const customTool = new ButtonGadget('user-tool', '🎨 Custom')

toolbar.addTool(selectTool)
toolbar.addTool(wireTool)

console.log('\nUser customizes toolbar:')
toolbar.addTool(customTool)

// ============================================================================
// Example: Querying UI
// ============================================================================
console.log('\nExample 5: Querying UI Elements')

const uiNetwork = new Network('ui-root')

// Add all our UI elements
uiNetwork.add(button, button1, button2, slider, progressBar)
uiNetwork.addChildNetwork(toolbar)

// Query for all buttons
const allButtons = uiNetwork.query('ButtonGadget')
console.log(`Found ${allButtons.size} buttons in UI`)

// Query for enabled elements (using Query directly)
const enabledGadgets = new Query(uiNetwork)
  .select('*')
  .where(g => {
    // In real implementation, we'd check the enabled cell
    return g.id.includes('btn')
  })
console.log(`Found ${enabledGadgets.count()} button-like gadgets`)

// Query toolbar contents
const toolbarTools = toolbar.query('ButtonGadget')
console.log(`Toolbar has ${toolbarTools.size} tools`)

// ============================================================================
// Summary
// ============================================================================
console.log('\n✨ Key Concepts Demonstrated:')
console.log('  1. UI elements are Networks containing cells')
console.log('  2. Properties (position, size, etc.) are cells')
console.log('  3. Properties can be wired together')
console.log('  4. UI chrome is just a modifiable network')
console.log('  5. UI can be queried like any network')
console.log('\n  → The UI *is* the computation graph!')