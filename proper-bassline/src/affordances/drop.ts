/**
 * DropAffordance - Handles drag and drop operations
 */

import { Affordance, type InputEvent } from '../affordance'
import { bool, dict, str, num } from '../types'
import type { LatticeValue } from '../types'
import type { Cell } from '../cell'

export class DropAffordance extends Affordance {
  // Configuration
  private acceptFilter?: (data: any) => boolean
  private isDragOver: boolean = false
  
  constructor(
    id: string = 'drop', 
    target?: Cell,
    acceptFilter?: (data: any) => boolean
  ) {
    super(id, target)
    
    this.acceptFilter = acceptFilter
    
    // Additional outputs
    this.setOutput('dragOver', bool(false))
    this.setOutput('lastDrop', dict(new Map()))
  }
  
  protected handleSpecificInput(event: InputEvent): boolean {
    if (event.type !== 'drop') return false
    
    // Check dragOver vs actual drop
    if (event.data?.dragOver !== undefined) {
      return this.handleDragOver(event.data.dragOver)
    }
    
    // Handle actual drop
    if (event.data?.dropped) {
      return this.handleDrop(event.data.dropped, event.position)
    }
    
    return false
  }
  
  private handleDragOver(isOver: boolean): boolean {
    this.isDragOver = isOver
    this.setOutput('dragOver', bool(isOver))
    return true
  }
  
  private handleDrop(data: any, position?: { x: number, y: number }): boolean {
    // Check if we accept this data
    if (this.acceptFilter && !this.acceptFilter(data)) {
      return false
    }
    
    // Create drop result
    const dropResult = new Map()
    
    // Add position if available
    if (position) {
      dropResult.set('position', dict({
        x: num(position.x),
        y: num(position.y)
      }))
    }
    
    // Add dropped data
    if (typeof data === 'string') {
      dropResult.set('data', str(data))
    } else if (typeof data === 'number') {
      dropResult.set('data', num(data))
    } else if (typeof data === 'boolean') {
      dropResult.set('data', bool(data))
    } else if (data && typeof data === 'object') {
      // Store as serialized JSON for now
      dropResult.set('data', str(JSON.stringify(data)))
      dropResult.set('dataType', str('json'))
    }
    
    const result = dict(dropResult)
    
    // Update outputs
    this.setOutput('lastDrop', result)
    this.isDragOver = false
    this.setOutput('dragOver', bool(false))
    
    // Emit the drop
    this.emitValue(result)
    
    return true
  }
  
  protected getDefaultOutput(): LatticeValue {
    return dict(new Map())
  }
  
  protected getAffordanceType(): string {
    return 'drop'
  }
  
  /**
   * Set the accept filter
   */
  setAcceptFilter(filter: (data: any) => boolean): void {
    this.acceptFilter = filter
  }
  
  /**
   * Check if currently dragging over
   */
  getIsDragOver(): boolean {
    return this.isDragOver
  }
}