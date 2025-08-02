import { PrimitiveGadget } from '../base/PrimitiveGadget'
import type { ContactGroup } from '../../models/ContactGroup'
import type { Contact } from '../../models/Contact'
import type { ContactId } from '../../types'

export class Splitter extends PrimitiveGadget {
  private outputCount: number
  
  constructor(parent?: ContactGroup, outputCount: number = 3) {
    const id = crypto.randomUUID()
    super(id, `Splitter${outputCount}`, parent)
    this.outputCount = outputCount
    
    // Create input contact
    const input = this.addBoundaryContact({ x: 50, y: 100 }, 'input', 'in')
    
    // Create output contacts
    const spacing = 120 / (outputCount + 1)
    for (let i = 0; i < outputCount; i++) {
      const y = spacing * (i + 1)
      this.addBoundaryContact({ x: 350, y }, 'output', `out${i + 1}`)
    }
  }
  
  protected activation(boundaryValues: Map<ContactId, [Contact, any]>): boolean {
    // Activate when input has a value
    const inputValue = Array.from(boundaryValues.values()).find(([c]) => c.name === 'in')?.[1]
    return inputValue !== undefined
  }
  
  protected body(boundaryValues: Map<ContactId, [Contact, any]>): Map<ContactId, any> {
    const outputs = new Map<ContactId, any>()
    
    // Get input value
    const inputEntry = Array.from(boundaryValues.values()).find(([c]) => c.name === 'in')
    const inputValue = inputEntry?.[1]
    
    if (inputValue === undefined) return outputs
    
    // Copy input to all outputs
    for (let i = 0; i < this.outputCount; i++) {
      const outputEntry = Array.from(boundaryValues.entries()).find(([_, [c]]) => c.name === `out${i + 1}`)
      if (outputEntry) {
        const [outputId] = outputEntry
        outputs.set(outputId, inputValue)
      }
    }
    
    return outputs
  }
}