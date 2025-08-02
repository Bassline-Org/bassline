import { PrimitiveGadget } from '../base/PrimitiveGadget'
import type { ContactGroup } from '../../models/ContactGroup'
import type { Contact } from '../../models/Contact'
import type { ContactId } from '../../types'
import { SetValue, StringSet } from '../../types/mergeable'

export class Difference extends PrimitiveGadget {
  constructor(parent?: ContactGroup) {
    const id = crypto.randomUUID()
    super(id, 'Difference', parent)
    
    // Create input contacts
    const a = this.addBoundaryContact({ x: 50, y: 80 }, 'input', 'a')
    const b = this.addBoundaryContact({ x: 50, y: 120 }, 'input', 'b')
    
    // Create output contact
    const result = this.addBoundaryContact({ x: 350, y: 100 }, 'output', 'result')
  }
  
  protected activation(boundaryValues: Map<ContactId, [Contact, any]>): boolean {
    // Need at least 'a' to compute difference
    const aValue = Array.from(boundaryValues.values()).find(([c]) => c.name === 'a')?.[1]
    return aValue !== undefined
  }
  
  protected body(boundaryValues: Map<ContactId, [Contact, any]>): Map<ContactId, any> {
    const outputs = new Map<ContactId, any>()
    
    // Get input values
    const aEntry = Array.from(boundaryValues.values()).find(([c]) => c.name === 'a')
    const bEntry = Array.from(boundaryValues.values()).find(([c]) => c.name === 'b')
    const aValue = aEntry?.[1]
    const bValue = bEntry?.[1]
    
    // Find output contact
    const resultEntry = Array.from(boundaryValues.entries()).find(([_, [c]]) => c.name === 'result')
    if (!resultEntry) return outputs
    const [resultId] = resultEntry
    
    // If b is undefined, return a as-is
    if (bValue === undefined) {
      outputs.set(resultId, aValue)
      return outputs
    }
    
    // Handle different set types
    if (aValue instanceof SetValue) {
      // SetValue difference
      const aArray = aValue.toArray()
      const bArray = bValue instanceof SetValue ? bValue.toArray() : [bValue]
      const difference = aArray.filter(x => !bArray.includes(x))
      outputs.set(resultId, new SetValue(difference))
    } else if (aValue instanceof StringSet) {
      // StringSet difference
      const aArray = aValue.toArray()
      const bArray = bValue instanceof StringSet ? bValue.toArray() : [String(bValue)]
      const difference = aArray.filter(x => !bArray.includes(x))
      outputs.set(resultId, new StringSet(difference))
    } else if (Array.isArray(aValue)) {
      // Array difference
      const bArray = Array.isArray(bValue) ? bValue : [bValue]
      const difference = aValue.filter(x => !bArray.includes(x))
      outputs.set(resultId, difference)
    } else {
      // Simple values - if equal, return empty; otherwise return a
      outputs.set(resultId, aValue === bValue ? undefined : aValue)
    }
    
    return outputs
  }
}