import { PrimitiveGadget } from '../base/PrimitiveGadget'
import type { ContactGroup } from '../../models/ContactGroup'
import type { Contact } from '../../models/Contact'
import type { ContactId } from '../../types'
import { SetValue, StringSet } from '../../types/mergeable'

export class Intersection extends PrimitiveGadget {
  constructor(parent?: ContactGroup) {
    const id = crypto.randomUUID()
    super(id, 'Intersection', parent)
    
    // Create input contacts
    const a = this.addBoundaryContact({ x: 50, y: 80 }, 'input', 'a')
    const b = this.addBoundaryContact({ x: 50, y: 120 }, 'input', 'b')
    
    // Create output contact
    const result = this.addBoundaryContact({ x: 350, y: 100 }, 'output', 'result')
  }
  
  protected activation(boundaryValues: Map<ContactId, [Contact, any]>): boolean {
    // Both inputs must be present for intersection
    const aValue = Array.from(boundaryValues.values()).find(([c]) => c.name === 'a')?.[1]
    const bValue = Array.from(boundaryValues.values()).find(([c]) => c.name === 'b')?.[1]
    return aValue !== undefined && bValue !== undefined
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
    if (aValue instanceof SetValue && bValue instanceof SetValue) {
      // SetValue intersection
      const aArray = aValue.toArray()
      const bArray = bValue.toArray()
      const intersection = aArray.filter(x => bArray.includes(x))
      outputs.set(resultId, new SetValue(intersection))
    } else if (aValue instanceof StringSet && bValue instanceof StringSet) {
      // StringSet intersection
      const aArray = aValue.toArray()
      const bArray = bValue.toArray()
      const intersection = aArray.filter(x => bArray.includes(x))
      outputs.set(resultId, new StringSet(intersection))
    } else if (Array.isArray(aValue) && Array.isArray(bValue)) {
      // Array intersection
      const intersection = aValue.filter(x => bValue.includes(x))
      outputs.set(resultId, intersection)
    } else {
      // Simple values - check if equal
      if (aValue === bValue) {
        outputs.set(resultId, aValue)
      } else {
        outputs.set(resultId, []) // Empty set for no intersection
      }
    }
    
    return outputs
  }
}