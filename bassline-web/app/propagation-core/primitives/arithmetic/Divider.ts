import { PrimitiveGadget } from '../base/PrimitiveGadget'
import type { ContactGroup } from '../../models/ContactGroup'
import type { Contact } from '../../models/Contact'
import type { ContactId } from '../../types'
import { Interval } from '../../types/mergeable'
import { Contradiction } from '../../types'

export class Divider extends PrimitiveGadget {
  private dividend: Contact
  private divisor: Contact
  private quotient: Contact
  
  constructor(parent?: ContactGroup) {
    const id = crypto.randomUUID()
    super(id, 'Divider', parent)
    
    // Create boundary contacts
    this.dividend = this.addBoundaryContact({ x: 50, y: 50 }, 'input', 'dividend')
    this.divisor = this.addBoundaryContact({ x: 50, y: 150 }, 'input', 'divisor')
    this.quotient = this.addBoundaryContact({ x: 250, y: 100 }, 'output', 'quotient')
  }
  
  protected activation(boundaryValues: Map<ContactId, [Contact, any]>): boolean {
    const [, dividendValue] = boundaryValues.get(this.dividend.id) || [null, undefined]
    const [, divisorValue] = boundaryValues.get(this.divisor.id) || [null, undefined]
    
    return dividendValue !== undefined && dividendValue !== null && divisorValue !== undefined && divisorValue !== null
  }
  
  protected body(boundaryValues: Map<ContactId, [Contact, any]>): Map<ContactId, any> {
    const outputs = new Map<ContactId, any>()
    
    const [, a] = boundaryValues.get(this.dividend.id) || [null, undefined]
    const [, b] = boundaryValues.get(this.divisor.id) || [null, undefined]
    
    // Handle different types of division
    let result: any
    
    if (typeof a === 'number' && typeof b === 'number') {
      // Check for division by zero
      if (b === 0) {
        result = new Contradiction('Division by zero')
      } else {
        result = a / b
      }
    } else if (a instanceof Interval && b instanceof Interval) {
      // Check if interval contains zero
      if (b.min <= 0 && b.max >= 0) {
        result = new Contradiction('Division by interval containing zero')
      } else {
        // Interval division: need to check all four corner cases
        const quotients = [
          a.min / b.min,
          a.min / b.max,
          a.max / b.min,
          a.max / b.max
        ]
        result = new Interval(Math.min(...quotients), Math.max(...quotients))
      }
    } else if (a instanceof Interval && typeof b === 'number') {
      // Interval / number
      if (b === 0) {
        result = new Contradiction('Division by zero')
      } else if (b > 0) {
        result = new Interval(a.min / b, a.max / b)
      } else {
        result = new Interval(a.max / b, a.min / b)
      }
    } else if (typeof a === 'number' && b instanceof Interval) {
      // Number / interval
      if (b.min <= 0 && b.max >= 0) {
        result = new Contradiction('Division by interval containing zero')
      } else {
        const quotients = [a / b.min, a / b.max]
        result = new Interval(Math.min(...quotients), Math.max(...quotients))
      }
    } else if (a instanceof Contradiction || b instanceof Contradiction) {
      // Propagate contradictions
      result = a instanceof Contradiction ? a : b
    } else {
      // Unsupported types - create a contradiction
      result = new Contradiction(`Cannot divide ${typeof a} by ${typeof b}`)
    }
    
    outputs.set(this.quotient.id, result)
    return outputs
  }
}