/**
 * Affordance - Interaction gadgets that translate user input into cell updates
 * 
 * Affordances are the bridge between user actions and the propagation network.
 * They detect interactions and emit values that can be wired to any cell.
 */

import { Cell } from './cell'
import { OrdinalCell } from './cells/basic'
import { bool, num, dict } from './types'
import type { LatticeValue } from './types'
import type { Point, Rect } from './visual-gadget'
import { getGadgetValue } from './value-helpers'

/**
 * Input event types that affordances can handle
 */
export interface InputEvent {
  type: 'tap' | 'drag' | 'drop' | 'hover' | 'key' | 'wheel' | 'pinch'
  position?: Point
  delta?: Point
  button?: number
  key?: string
  modifiers?: {
    shift?: boolean
    ctrl?: boolean
    alt?: boolean
    meta?: boolean
  }
  data?: any
}

/**
 * Base class for all affordances
 * Affordances are cells that translate user input into values
 */
export abstract class Affordance extends Cell {
  // What this affordance affects (optional - can also just emit)
  target?: Cell
  
  // Control cells
  enabled: OrdinalCell
  bounds: OrdinalCell  // Where the interaction is active
  
  // Output cell for the interaction result
  output: OrdinalCell
  
  constructor(id: string, target?: Cell) {
    super(id)
    
    this.target = target
    
    // Create control cells
    this.enabled = new OrdinalCell(`${id}-enabled`)
    this.bounds = new OrdinalCell(`${id}-bounds`)
    this.output = new OrdinalCell(`${id}-output`)
    
    // Set defaults
    this.enabled.userInput(bool(true))
    this.bounds.userInput(dict(new Map()))  // No bounds = global
    this.output.userInput(this.getDefaultOutput())
    
    // Set metadata
    this.setMetadata('affordance', true)
    this.setMetadata('affordanceType', this.getAffordanceType())
  }
  
  /**
   * Handle an input event
   * Returns true if the event was handled
   */
  handleInput(event: InputEvent): boolean {
    // Check if enabled
    const isEnabled = getGadgetValue(this.enabled)
    
    if (!isEnabled) return false
    
    // Check if event is within bounds (if bounds are set)
    if (!this.isWithinBounds(event)) return false
    
    // Let subclass handle the specific event
    return this.handleSpecificInput(event)
  }
  
  /**
   * Check if an event is within this affordance's bounds
   */
  protected isWithinBounds(event: InputEvent): boolean {
    const boundsValue = this.bounds.getOutput()
    
    // No bounds means global/always active
    if (!boundsValue || boundsValue.type === 'null') return true
    
    // Extract bounds rect
    const bounds = getGadgetValue(this.bounds)
    
    if (!bounds || !event.position) return true
    
    // Check if position is within bounds
    return event.position.x >= bounds.x &&
           event.position.x <= bounds.x + bounds.width &&
           event.position.y >= bounds.y &&
           event.position.y <= bounds.y + bounds.height
  }
  
  /**
   * Set the bounds for this affordance
   */
  setBounds(rect: Rect): this {
    this.bounds.userInput(dict({
      x: num(rect.x),
      y: num(rect.y),
      width: num(rect.width),
      height: num(rect.height)
    }))
    return this
  }
  
  /**
   * Enable or disable this affordance
   */
  setEnabled(enabled: boolean): this {
    this.enabled.userInput(bool(enabled))
    return this
  }
  
  /**
   * Emit a value from this affordance
   * This is what gets wired to other cells
   */
  protected emitValue(value: LatticeValue): void {
    this.output.userInput(value)
    
    // If we have a target, also send directly
    if (this.target) {
      this.target.accept(value, this)
    }
    
    // Emit to downstream
    this.emit()
  }
  
  /**
   * Get the output value
   */
  getOutput(name: string = 'default'): LatticeValue {
    if (name === 'default') {
      return this.output.getOutput()
    }
    return super.getOutput(name)
  }
  
  // ============================================================================
  // Abstract methods for subclasses
  // ============================================================================
  
  /**
   * Handle the specific input event type
   * Subclasses implement this to handle their specific events
   */
  protected abstract handleSpecificInput(event: InputEvent): boolean
  
  /**
   * Get the default output value for this affordance
   */
  protected abstract getDefaultOutput(): LatticeValue
  
  /**
   * Get the type of this affordance (for metadata)
   */
  protected abstract getAffordanceType(): string
  
  // ============================================================================
  // Lattice operation (required for Cell)
  // ============================================================================
  
  latticeOp(...values: LatticeValue[]): LatticeValue {
    // Affordances typically don't merge inputs, they generate outputs
    // But if multiple sources try to control an affordance, take the last one
    return values[values.length - 1] || this.getDefaultOutput()
  }
  
  // ============================================================================
  // Serialization
  // ============================================================================
  
  serialize(): any {
    const base = super.serialize()
    base.type = 'affordance'
    base.affordanceType = this.getAffordanceType()
    base.targetId = this.target?.id
    base.enabledId = this.enabled.id
    base.boundsId = this.bounds.id
    base.outputId = this.output.id
    return base
  }
}