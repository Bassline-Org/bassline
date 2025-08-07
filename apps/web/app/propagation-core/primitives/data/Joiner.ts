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
    
    // Collect all input values in order (preserving undefined slots)
    const inputValues: any[] = []
    for (let i = 0; i < this.inputCount; i++) {
      const inputEntry = Array.from(boundaryValues.values()).find(([c]) => c.name === `in${i + 1}`)
      const inputValue = inputEntry?.[1]
      // Always push the value (even if undefined) to maintain array structure
      inputValues.push(inputValue)
    }
    
    // Find output contact
    const outputEntry = Array.from(boundaryValues.entries()).find(([_, [c]]) => c.name === 'out')
    if (!outputEntry) return outputs
    const [outputId] = outputEntry
    
    // Output as array - filter out trailing undefined values for cleaner arrays
    let lastDefinedIndex = -1
    for (let i = inputValues.length - 1; i >= 0; i--) {
      if (inputValues[i] !== undefined) {
        lastDefinedIndex = i
        break
      }
    }
    
    // Slice to remove trailing undefineds
    const trimmedValues = lastDefinedIndex === -1 ? [] : inputValues.slice(0, lastDefinedIndex + 1)
    
    outputs.set(outputId, trimmedValues)
    
    return outputs
  }
}