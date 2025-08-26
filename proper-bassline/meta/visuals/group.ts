/**
 * GroupGadget - Container for other visual gadgets
 * Groups can apply transforms and clips to their children
 */

import { VisualGadget } from '../visual-gadget'
import { OrdinalCell } from '../cells/basic'
import { num, str, bool, dict } from '../types'

export class GroupGadget extends VisualGadget {
  // Group-specific properties
  transform: OrdinalCell      // Transform matrix or string
  clipPath: OrdinalCell       // Clipping path
  overflow: OrdinalCell       // How to handle overflow
  
  constructor(id: string = 'group') {
    super(id)
    
    // Create group-specific cells
    this.transform = new OrdinalCell(`${id}-transform`)
    this.clipPath = new OrdinalCell(`${id}-clipPath`)
    this.overflow = new OrdinalCell(`${id}-overflow`)
    
    // Set defaults
    this.transform.userInput(str(''))
    this.clipPath.userInput(str(''))
    this.overflow.userInput(str('visible'))
    
    // Add to network
    this.add(this.transform, this.clipPath, this.overflow)
    
    // Set metadata
    this.setMetadata('shape', 'group')
    this.setMetadata('container', true)
  }
  
  // Transform helpers
  setTranslate(x: number, y: number): this {
    this.transform.userInput(str(`translate(${x}, ${y})`))
    return this
  }
  
  setScale(x: number, y?: number): this {
    const scaleY = y !== undefined ? y : x
    this.transform.userInput(str(`scale(${x}, ${scaleY})`))
    return this
  }
  
  setRotate(degrees: number, centerX?: number, centerY?: number): this {
    if (centerX !== undefined && centerY !== undefined) {
      this.transform.userInput(str(`rotate(${degrees}, ${centerX}, ${centerY})`))
    } else {
      this.transform.userInput(str(`rotate(${degrees})`))
    }
    return this
  }
  
  setTransform(transform: string): this {
    this.transform.userInput(str(transform))
    return this
  }
  
  // Clipping
  setClipPath(path: string): this {
    this.clipPath.userInput(str(path))
    return this
  }
  
  setOverflow(overflow: 'visible' | 'hidden' | 'scroll' | 'auto'): this {
    this.overflow.userInput(str(overflow))
    return this
  }
  
  getRendererType(): string {
    return 'group'
  }
  
  serialize(): any {
    const base = super.serialize()
    base.type = 'group-gadget'
    base.groupProperties = {
      transformId: this.transform.id,
      clipPathId: this.clipPath.id,
      overflowId: this.overflow.id
    }
    return base
  }
}