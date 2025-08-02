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
    
    // If input is an array, destructure it to outputs
    if (Array.isArray(inputValue)) {
      for (let i = 0; i < this.outputCount; i++) {
        const outputEntry = Array.from(boundaryValues.entries()).find(([_, [c]]) => c.name === `out${i + 1}`)
        if (outputEntry) {
          const [outputId] = outputEntry
          // Get the i-th element if it exists, otherwise undefined
          outputs.set(outputId, i < inputValue.length ? inputValue[i] : undefined)
        }
      }
    } else if (inputValue instanceof Set || inputValue.constructor?.name === 'SetValue' || inputValue.constructor?.name === 'StringSet') {
      // For sets, convert to array first
      const array = Array.from(inputValue instanceof Set ? inputValue : inputValue.toArray?.() || [])
      for (let i = 0; i < this.outputCount; i++) {
        const outputEntry = Array.from(boundaryValues.entries()).find(([_, [c]]) => c.name === `out${i + 1}`)
        if (outputEntry) {
          const [outputId] = outputEntry
          outputs.set(outputId, i < array.length ? array[i] : undefined)
        }
      }
    } else if (typeof inputValue === 'object' && inputValue !== null && inputValue.constructor === Object) {
      // For plain objects, destructure by key order
      const entries = Object.entries(inputValue)
      for (let i = 0; i < this.outputCount; i++) {
        const outputEntry = Array.from(boundaryValues.entries()).find(([_, [c]]) => c.name === `out${i + 1}`)
        if (outputEntry) {
          const [outputId] = outputEntry
          outputs.set(outputId, i < entries.length ? entries[i][1] : undefined)
        }
      }
    } else {
      // For scalar values, send to first output only
      const outputEntry = Array.from(boundaryValues.entries()).find(([_, [c]]) => c.name === 'out1')
      if (outputEntry) {
        const [outputId] = outputEntry
        outputs.set(outputId, inputValue)
      }
      // Other outputs get undefined
      for (let i = 1; i < this.outputCount; i++) {
        const outputEntry = Array.from(boundaryValues.entries()).find(([_, [c]]) => c.name === `out${i + 1}`)
        if (outputEntry) {
          const [outputId] = outputEntry
          outputs.set(outputId, undefined)
        }
      }
    }
    
    return outputs
  }
}