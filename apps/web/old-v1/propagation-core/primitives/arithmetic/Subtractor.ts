import { PrimitiveGadget } from '../base/PrimitiveGadget'
import type { ContactGroup } from '../../models/ContactGroup'
import type { Contact } from '../../models/Contact'
import type { ContactId } from '../../types'
import { Interval } from '../../types/mergeable'
import { Contradiction } from '../../types'

export class Subtractor extends PrimitiveGadget {
  private minuend: Contact
  private subtrahend: Contact
  private difference: Contact
  
  constructor(parent?: ContactGroup) {
    const id = crypto.randomUUID()
    super(id, 'Subtractor', parent)
    
    // Create boundary contacts
    this.minuend = this.addBoundaryContact({ x: 50, y: 50 }, 'input', 'minuend')
    this.subtrahend = this.addBoundaryContact({ x: 50, y: 150 }, 'input', 'subtrahend')
    this.difference = this.addBoundaryContact({ x: 250, y: 100 }, 'output', 'difference')
  }
  
  protected activation(boundaryValues: Map<ContactId, [Contact, any]>): boolean {
    const [, minuendValue] = boundaryValues.get(this.minuend.id) || [null, undefined]
    const [, subtrahendValue] = boundaryValues.get(this.subtrahend.id) || [null, undefined]
    
    // Activate only when both inputs have values
    return minuendValue !== undefined && minuendValue !== null && subtrahendValue !== undefined && subtrahendValue !== null
  }
  
  protected body(boundaryValues: Map<ContactId, [Contact, any]>): Map<ContactId, any> {
    const outputs = new Map<ContactId, any>()
    
    const [, a] = boundaryValues.get(this.minuend.id) || [null, undefined]
    const [, b] = boundaryValues.get(this.subtrahend.id) || [null, undefined]
    
    // Handle different types of subtraction
    let result: any
    
    if (typeof a === 'number' && typeof b === 'number') {
      // Simple numeric subtraction
      result = a - b
    } else if (a instanceof Interval && b instanceof Interval) {
      // Interval subtraction: [a.min, a.max] - [b.min, b.max] = [a.min - b.max, a.max - b.min]
      result = new Interval(a.min - b.max, a.max - b.min)
    } else if (a instanceof Interval && typeof b === 'number') {
      // Interval - number
      result = new Interval(a.min - b, a.max - b)
    } else if (typeof a === 'number' && b instanceof Interval) {
      // Number - interval
      result = new Interval(a - b.max, a - b.min)
    } else if (a instanceof Contradiction || b instanceof Contradiction) {
      // Propagate contradictions
      result = a instanceof Contradiction ? a : b
    } else {
      // Unsupported types - create a contradiction
      result = new Contradiction(`Cannot subtract ${typeof b} from ${typeof a}`)
    }
    
    outputs.set(this.difference.id, result)
    return outputs
  }
}