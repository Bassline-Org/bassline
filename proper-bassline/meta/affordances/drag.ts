/**
 * DragAffordance - Detects drag gestures and emits position deltas
 */

import { Affordance, type InputEvent } from '../meta/affordance'
import { dict, num, bool } from '../types'
import type { LatticeValue } from '../types'
import type { Cell } from '../cell'
import type { Point } from '../visual-gadget'

export class DragAffordance extends Affordance {
  // Drag state
  private isDragging: boolean = false
  private startPosition: Point | null = null
  private currentPosition: Point | null = null
  
  constructor(id: string = 'drag', target?: Cell) {
    super(id, target)
    
    // Additional output for drag state
    this.setOutput('dragging', bool(false))
  }
  
  protected handleSpecificInput(event: InputEvent): boolean {
    switch (event.type) {
      case 'drag':
        return this.handleDrag(event)
      case 'tap':
        // Tap can start or end a drag
        if (!this.isDragging && event.position) {
          return this.startDrag(event.position)
        } else if (this.isDragging) {
          return this.endDrag()
        }
        return false
      default:
        return false
    }
  }
  
  private handleDrag(event: InputEvent): boolean {
    if (!event.position || !event.delta) return false
    
    // Start dragging if not already
    if (!this.isDragging) {
      this.startDrag(event.position)
    }
    
    // Update position
    this.currentPosition = event.position
    
    // Emit delta
    this.emitValue(dict({
      dx: num(event.delta.x),
      dy: num(event.delta.y),
      x: num(event.position.x),
      y: num(event.position.y)
    }))
    
    return true
  }
  
  private startDrag(position: Point): boolean {
    this.isDragging = true
    this.startPosition = position
    this.currentPosition = position
    
    // Update dragging state
    this.setOutput('dragging', bool(true))
    
    // Emit initial position
    this.emitValue(dict({
      dx: num(0),
      dy: num(0),
      x: num(position.x),
      y: num(position.y)
    }))
    
    return true
  }
  
  private endDrag(): boolean {
    if (!this.isDragging) return false
    
    this.isDragging = false
    
    // Update dragging state
    this.setOutput('dragging', bool(false))
    
    // Emit final position with zero delta
    if (this.currentPosition) {
      this.emitValue(dict({
        dx: num(0),
        dy: num(0),
        x: num(this.currentPosition.x),
        y: num(this.currentPosition.y)
      }))
    }
    
    this.startPosition = null
    this.currentPosition = null
    
    return true
  }
  
  protected getDefaultOutput(): LatticeValue {
    return dict({
      dx: num(0),
      dy: num(0),
      x: num(0),
      y: num(0)
    })
  }
  
  protected getAffordanceType(): string {
    return 'drag'
  }
  
  /**
   * Get whether currently dragging
   */
  getIsDragging(): boolean {
    return this.isDragging
  }
  
  /**
   * Get the total drag offset from start
   */
  getTotalOffset(): Point | null {
    if (!this.startPosition || !this.currentPosition) return null
    
    return {
      x: this.currentPosition.x - this.startPosition.x,
      y: this.currentPosition.y - this.startPosition.y
    }
  }
}