/**
 * TextGadget - A text visual element
 */

import { VisualGadget } from '../visual-gadget'
import { OrdinalCell } from '../cells/basic'
import { num, str } from '../types'

export class TextGadget extends VisualGadget {
  type = 'TextGadget'
  
  // Text-specific properties
  text: OrdinalCell
  fontSize: OrdinalCell
  fontFamily: OrdinalCell
  fontWeight: OrdinalCell
  color: OrdinalCell
  textAlign: OrdinalCell
  lineHeight: OrdinalCell
  
  constructor(id: string = 'text', initialText: string = '') {
    super(id)
    
    // Create text-specific cells
    this.text = new OrdinalCell(`${id}-text`)
    this.fontSize = new OrdinalCell(`${id}-fontSize`)
    this.fontFamily = new OrdinalCell(`${id}-fontFamily`)
    this.fontWeight = new OrdinalCell(`${id}-fontWeight`)
    this.color = new OrdinalCell(`${id}-color`)
    this.textAlign = new OrdinalCell(`${id}-textAlign`)
    this.lineHeight = new OrdinalCell(`${id}-lineHeight`)
    
    // Set defaults
    this.text.userInput(str(initialText))
    this.fontSize.userInput(num(14))
    this.fontFamily.userInput(str('sans-serif'))
    this.fontWeight.userInput(str('normal'))
    this.color.userInput(str('#000000'))
    this.textAlign.userInput(str('left'))
    this.lineHeight.userInput(num(1.5))
    
    // Add to network
    this.add(
      this.text,
      this.fontSize,
      this.fontFamily,
      this.fontWeight,
      this.color,
      this.textAlign,
      this.lineHeight
    )
    
    // Set metadata
    this.setMetadata('shape', 'text')
  }
  
  // Convenience setters
  setText(text: string): this {
    this.text.userInput(str(text))
    return this
  }
  
  setFontSize(size: number): this {
    this.fontSize.userInput(num(size))
    return this
  }
  
  setFontFamily(family: string): this {
    this.fontFamily.userInput(str(family))
    return this
  }
  
  setFontWeight(weight: string | number): this {
    if (typeof weight === 'number') {
      this.fontWeight.userInput(num(weight))
    } else {
      this.fontWeight.userInput(str(weight))
    }
    return this
  }
  
  setColor(color: string): this {
    this.color.userInput(str(color))
    return this
  }
  
  setTextAlign(align: 'left' | 'center' | 'right' | 'justify'): this {
    this.textAlign.userInput(str(align))
    return this
  }
  
  setLineHeight(height: number): this {
    this.lineHeight.userInput(num(height))
    return this
  }
  
  getRendererType(): string {
    return 'text'
  }
  
  serialize(): any {
    const base = super.serialize()
    base.type = 'text-gadget'
    base.textProperties = {
      textId: this.text.id,
      fontSizeId: this.fontSize.id,
      fontFamilyId: this.fontFamily.id,
      fontWeightId: this.fontWeight.id,
      colorId: this.color.id,
      textAlignId: this.textAlign.id,
      lineHeightId: this.lineHeight.id
    }
    return base
  }
}