import { PrimitiveGadget } from '../base/PrimitiveGadget'
import type { ContactGroup } from '../../models/ContactGroup'
import type { Contact } from '../../models/Contact'
import type { ContactId } from '../../types'

export class Joiner extends PrimitiveGadget {
  private inputCount: number
  
  constructor(parent?: ContactGroup, inputCount: number = 3) {
    const id = crypto.randomUUID()
    super(id, `Joiner${inputCount}`, parent)
    this.inputCount = inputCount
    
    // Create input contacts
    const spacing = 120 / (inputCount + 1)
    for (let i = 0; i < inputCount; i++) {
      const y = spacing * (i + 1)
      this.addBoundaryContact({ x: 50, y }, 'input', `in${i + 1}`)
    }
    
    // Create output contact
    const output = this.addBoundaryContact({ x: 350, y: 100 }, 'output', 'out')
  }
  
  protected activation(boundaryValues: Map<ContactId, [Contact, any]>): boolean {
    // Activate when at least one input has a value
    for (let i = 0; i < this.inputCount; i++) {
      const inputValue = Array.from(boundaryValues.values()).find(([c]) => c.name === `in${i + 1}`)?.[1]
      if (inputValue !== undefined) return true
    }
    return false
  }
  
  protected body(boundaryValues: Map<ContactId, [Contact, any]>): Map<ContactId, any> {
    const outputs = new Map<ContactId, any>()
    
    // Collect all input values
    const inputValues: any[] = []
    for (let i = 0; i < this.inputCount; i++) {
      const inputEntry = Array.from(boundaryValues.values()).find(([c]) => c.name === `in${i + 1}`)
      const inputValue = inputEntry?.[1]
      if (inputValue !== undefined) {
        inputValues.push(inputValue)
      }
    }
    
    // Find output contact
    const outputEntry = Array.from(boundaryValues.entries()).find(([_, [c]]) => c.name === 'out')
    if (!outputEntry) return outputs
    const [outputId] = outputEntry
    
    // Output as array
    outputs.set(outputId, inputValues)
    
    return outputs
  }
}