/**
 * HoverAffordance - Detects mouse hover and emits boolean state
 */

import { Affordance, type InputEvent } from '../affordance'
import { bool, dict, num } from '../types'
import type { LatticeValue } from '../types'
import type { Cell } from '../cell'

export class HoverAffordance extends Affordance {
  // Hover state
  private isHovering: boolean = false
  private hoverPosition: { x: number, y: number } | null = null
  
  constructor(id: string = 'hover', target?: Cell) {
    super(id, target)
    
    // Additional output for hover position
    this.setOutput('position', dict(new Map()))
  }
  
  protected handleSpecificInput(event: InputEvent): boolean {
    if (event.type !== 'hover') return false
    
    // Check if we're entering or leaving hover
    const wasHovering = this.isHovering
    this.isHovering = event.data?.hovering || false
    
    if (this.isHovering && event.position) {
      this.hoverPosition = event.position
      
      // Update position output
      this.setOutput('position', dict({
        x: num(event.position.x),
        y: num(event.position.y)
      }))
    } else {
      this.hoverPosition = null
      this.setOutput('position', dict(new Map()))
    }
    
    // Only emit if state changed
    if (wasHovering !== this.isHovering) {
      this.emitValue(bool(this.isHovering))
    }
    
    return true
  }
  
  protected getDefaultOutput(): LatticeValue {
    return bool(false)
  }
  
  protected getAffordanceType(): string {
    return 'hover'
  }
  
  /**
   * Get current hover state
   */
  getIsHovering(): boolean {
    return this.isHovering
  }
  
  /**
   * Get current hover position
   */
  getHoverPosition(): { x: number, y: number } | null {
    return this.hoverPosition
  }
}