import { PrimitiveGadget } from '../base/PrimitiveGadget'
import type { ContactGroup } from '../../models/ContactGroup'
import type { Contact } from '../../models/Contact'
import type { ContactId } from '../../types'
import { SetValue, StringSet } from '../../types/mergeable'

export class Union extends PrimitiveGadget {
  constructor(parent?: ContactGroup) {
    const id = crypto.randomUUID()
    super(id, 'Union', parent)
    
    // Create input contacts
    const a = this.addBoundaryContact({ x: 50, y: 80 }, 'input', 'a')
    const b = this.addBoundaryContact({ x: 50, y: 120 }, 'input', 'b')
    
    // Create output contact
    const result = this.addBoundaryContact({ x: 350, y: 100 }, 'output', 'result')
  }
  
  protected activation(boundaryValues: Map<ContactId, [Contact, any]>): boolean {
    // At least one input must be present
    const aValue = Array.from(boundaryValues.values()).find(([c]) => c.name === 'a')?.[1]
    const bValue = Array.from(boundaryValues.values()).find(([c]) => c.name === 'b')?.[1]
    return aValue !== undefined || bValue !== undefined
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
    
    // Handle different set types
    if (aValue instanceof SetValue || bValue instanceof SetValue) {
      // SetValue union
      const aSet = aValue instanceof SetValue ? aValue : new SetValue(aValue !== undefined ? [aValue] : [])
      const bSet = bValue instanceof SetValue ? bValue : new SetValue(bValue !== undefined ? [bValue] : [])
      outputs.set(resultId, aSet.merge(bSet))
    } else if (aValue instanceof StringSet || bValue instanceof StringSet) {
      // StringSet union
      const aSet = aValue instanceof StringSet ? aValue : new StringSet(aValue !== undefined ? [String(aValue)] : [])
      const bSet = bValue instanceof StringSet ? bValue : new StringSet(bValue !== undefined ? [String(bValue)] : [])
      outputs.set(resultId, aSet.merge(bSet))
    } else if (Array.isArray(aValue) || Array.isArray(bValue)) {
      // Array union (remove duplicates)
      const aArr = Array.isArray(aValue) ? aValue : (aValue !== undefined ? [aValue] : [])
      const bArr = Array.isArray(bValue) ? bValue : (bValue !== undefined ? [bValue] : [])
      const union = [...new Set([...aArr, ...bArr])]
      outputs.set(resultId, union)
    } else if (aValue !== undefined || bValue !== undefined) {
      // Simple values - create array
      const result = []
      if (aValue !== undefined) result.push(aValue)
      if (bValue !== undefined && aValue !== bValue) result.push(bValue)
      outputs.set(resultId, result.length === 1 ? result[0] : result)
    }
    
    return outputs
  }
}