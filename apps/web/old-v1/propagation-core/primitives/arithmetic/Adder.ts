import { PrimitiveGadget } from '../base/PrimitiveGadget'
import type { ContactGroup } from '../../models/ContactGroup'
import type { Contact } from '../../models/Contact'
import type { ContactId } from '../../types'
import { Interval } from '../../types/mergeable'
import { Contradiction } from '../../types'

export class Adder extends PrimitiveGadget {
  private inputA: Contact
  private inputB: Contact
  private output: Contact
  
  constructor(parent?: ContactGroup) {
    const id = crypto.randomUUID()
    super(id, 'Adder', parent)
    
    // Create boundary contacts
    this.inputA = this.addBoundaryContact({ x: 50, y: 50 }, 'input', 'a')
    this.inputB = this.addBoundaryContact({ x: 50, y: 150 }, 'input', 'b')
    this.output = this.addBoundaryContact({ x: 250, y: 100 }, 'output', 'sum')
  }
  
  protected activation(boundaryValues: Map<ContactId, [Contact, any]>): boolean {
    const [, aValue] = boundaryValues.get(this.inputA.id) || [null, undefined]
    const [, bValue] = boundaryValues.get(this.inputB.id) || [null, undefined]
    
    // Activate only when both inputs have values
    return aValue !== undefined && aValue !== null && bValue !== undefined && bValue !== null
  }
  
  protected body(boundaryValues: Map<ContactId, [Contact, any]>): Map<ContactId, any> {
    const outputs = new Map<ContactId, any>()
    
    const [, a] = boundaryValues.get(this.inputA.id) || [null, undefined]
    const [, b] = boundaryValues.get(this.inputB.id) || [null, undefined]
    
    // Handle different types of addition
    let result: any
    
    if (typeof a === 'number' && typeof b === 'number') {
      // Simple numeric addition
      result = a + b
    } else if (a instanceof Interval && b instanceof Interval) {
      // Interval addition: [a.min, a.max] + [b.min, b.max] = [a.min + b.min, a.max + b.max]
      result = new Interval(a.min + b.min, a.max + b.max)
    } else if (a instanceof Interval && typeof b === 'number') {
      // Interval + number
      result = new Interval(a.min + b, a.max + b)
    } else if (typeof a === 'number' && b instanceof Interval) {
      // Number + interval
      result = new Interval(a + b.min, a + b.max)
    } else if (a instanceof Contradiction || b instanceof Contradiction) {
      // Propagate contradictions
      result = a instanceof Contradiction ? a : b
    } else {
      // Unsupported types - create a contradiction
      result = new Contradiction(`Cannot add ${typeof a} and ${typeof b}`)
    }
    
    outputs.set(this.output.id, result)
    return outputs
  }
}