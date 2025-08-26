/**
 * RectGadget - A rectangular visual element
 */

import { VisualGadget } from '../visual-gadget'
import { OrdinalCell } from '../cells/basic'
import { num, str, dict } from '../types'

export class RectGadget extends VisualGadget {
  type = 'RectGadget'
  
  // Rectangle-specific properties
  borderRadius: OrdinalCell
  borderWidth: OrdinalCell
  borderColor: OrdinalCell
  backgroundColor: OrdinalCell
  
  constructor(id: string = 'rect') {
    super(id)
    
    // Create rectangle-specific cells
    this.borderRadius = new OrdinalCell(`${id}-borderRadius`)
    this.borderWidth = new OrdinalCell(`${id}-borderWidth`)
    this.borderColor = new OrdinalCell(`${id}-borderColor`)
    this.backgroundColor = new OrdinalCell(`${id}-backgroundColor`)
    
    // Set defaults
    this.borderRadius.userInput(num(0))
    this.borderWidth.userInput(num(1))
    this.borderColor.userInput(str('#000000'))
    this.backgroundColor.userInput(str('#ffffff'))
    
    // Add to network
    this.add(
      this.borderRadius,
      this.borderWidth,
      this.borderColor,
      this.backgroundColor
    )
    
    // Set metadata
    this.setMetadata('shape', 'rect')
  }
  
  // Convenience setters
  setBorderRadius(radius: number): this {
    this.borderRadius.userInput(num(radius))
    return this
  }
  
  setBorderWidth(width: number): this {
    this.borderWidth.userInput(num(width))
    return this
  }
  
  setBorderColor(color: string): this {
    this.borderColor.userInput(str(color))
    return this
  }
  
  setBackgroundColor(color: string): this {
    this.backgroundColor.userInput(str(color))
    return this
  }
  
  getRendererType(): string {
    return 'rect'
  }
  
  serialize(): any {
    const base = super.serialize()
    base.type = 'rect-gadget'
    base.rectProperties = {
      borderRadiusId: this.borderRadius.id,
      borderWidthId: this.borderWidth.id,
      borderColorId: this.borderColor.id,
      backgroundColorId: this.backgroundColor.id
    }
    return base
  }
}