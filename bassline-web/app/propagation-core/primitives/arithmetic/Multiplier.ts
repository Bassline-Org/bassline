import { PrimitiveGadget } from '../base/PrimitiveGadget'
import type { ContactGroup } from '../../models/ContactGroup'
import type { Contact } from '../../models/Contact'
import type { ContactId } from '../../types'
import { Interval } from '../../types/mergeable'
import { Contradiction } from '../../types'

export class Multiplier extends PrimitiveGadget {
  private inputA: Contact
  private inputB: Contact
  private product: Contact
  
  constructor(parent?: ContactGroup) {
    const id = crypto.randomUUID()
    super(id, 'Multiplier', parent)
    
    // Create boundary contacts
    this.inputA = this.addBoundaryContact({ x: 50, y: 50 }, 'input', 'a')
    this.inputB = this.addBoundaryContact({ x: 50, y: 150 }, 'input', 'b')
    this.product = this.addBoundaryContact({ x: 250, y: 100 }, 'output', 'product')
  }
  
  protected activation(boundaryValues: Map<ContactId, [Contact, any]>): boolean {
    const [, aValue] = boundaryValues.get(this.inputA.id) || [null, undefined]
    const [, bValue] = boundaryValues.get(this.inputB.id) || [null, undefined]
    
    return aValue !== undefined && aValue !== null && bValue !== undefined && bValue !== null
  }
  
  protected body(boundaryValues: Map<ContactId, [Contact, any]>): Map<ContactId, any> {
    const outputs = new Map<ContactId, any>()
    
    const [, a] = boundaryValues.get(this.inputA.id) || [null, undefined]
    const [, b] = boundaryValues.get(this.inputB.id) || [null, undefined]
    
    // Handle different types of multiplication
    let result: any
    
    if (typeof a === 'number' && typeof b === 'number') {
      // Simple numeric multiplication
      result = a * b
    } else if (a instanceof Interval && b instanceof Interval) {
      // Interval multiplication: need to check all four corner cases
      const products = [
        a.min * b.min,
        a.min * b.max,
        a.max * b.min,
        a.max * b.max
      ]
      result = new Interval(Math.min(...products), Math.max(...products))
    } else if (a instanceof Interval && typeof b === 'number') {
      // Interval * number
      if (b >= 0) {
        result = new Interval(a.min * b, a.max * b)
      } else {
        result = new Interval(a.max * b, a.min * b)
      }
    } else if (typeof a === 'number' && b instanceof Interval) {
      // Number * interval
      if (a >= 0) {
        result = new Interval(a * b.min, a * b.max)
      } else {
        result = new Interval(a * b.max, a * b.min)
      }
    } else if (a instanceof Contradiction || b instanceof Contradiction) {
      // Propagate contradictions
      result = a instanceof Contradiction ? a : b
    } else {
      // Unsupported types - create a contradiction
      result = new Contradiction(`Cannot multiply ${typeof a} and ${typeof b}`)
    }
    
    outputs.set(this.product.id, result)
    return outputs
  }
}