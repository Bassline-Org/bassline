import { describe, it, expect } from 'vitest'
import { wiresToEdges } from '../EdgeRenderer'
import { ContactGroupImpl } from '../../../models/ContactGroup'
import { ContactImpl } from '../../../models/Contact'
import { BoundaryContactImpl } from '../../../models/BoundaryContact'
import { ContactGroupWireImpl } from '../../../models/ContactGroupWire'
import { AcceptLastValue } from '../../../models/blendModes'
import { EventEmitter } from '../../../utils/EventEmitter'

describe('Gadget Output Connections', () => {
  it('should create edges FROM gadget output boundaries with source handles', () => {
    const eventEmitter = new EventEmitter()
    const rootGroup = new ContactGroupImpl('root', 'Root', { x: 0, y: 0 }, eventEmitter)
    
    // Create an adder gadget
    const adder = new ContactGroupImpl('adder1', '+', { x: 100, y: 100 }, eventEmitter)
    rootGroup.addSubgroup(adder)
    
    // Create boundary contacts - 3 inputs on left, 3 outputs on right
    const in1 = new BoundaryContactImpl('in1', { x: 0, y: 20 }, new AcceptLastValue(), eventEmitter)
    const in2 = new BoundaryContactImpl('in2', { x: 0, y: 40 }, new AcceptLastValue(), eventEmitter)
    const in3 = new BoundaryContactImpl('in3', { x: 0, y: 60 }, new AcceptLastValue(), eventEmitter)
    
    const out1 = new BoundaryContactImpl('out1', { x: 50, y: 20 }, new AcceptLastValue(), eventEmitter)
    const out2 = new BoundaryContactImpl('out2', { x: 50, y: 40 }, new AcceptLastValue(), eventEmitter)
    const out3 = new BoundaryContactImpl('out3', { x: 50, y: 60 }, new AcceptLastValue(), eventEmitter)
    
    adder.addContact(in1)
    adder.addContact(in2)
    adder.addContact(in3)
    adder.addContact(out1)
    adder.addContact(out2)
    adder.addContact(out3)
    
    // Create a regular contact to receive output
    const receiver = new ContactImpl('receiver', { x: 300, y: 100 }, new AcceptLastValue(), eventEmitter)
    rootGroup.addContact(receiver)
    
    // Create wire FROM output boundary TO receiver
    const wire = new ContactGroupWireImpl('w1', 'out1', 'receiver', rootGroup.id, eventEmitter)
    rootGroup.wires.set(wire.id, wire)
    
    // Convert to edges
    const edges = wiresToEdges(rootGroup)
    
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({
      id: 'w1',
      source: 'adder1', // Source should be the gadget
      target: 'receiver',
      sourceHandle: 'out1-right-source', // Should be a SOURCE handle on the RIGHT
      targetHandle: undefined,
      type: 'contactWire'
    })
  })
  
  it('should create edges TO gadget input boundaries with target handles', () => {
    const eventEmitter = new EventEmitter()
    const rootGroup = new ContactGroupImpl('root', 'Root', { x: 0, y: 0 }, eventEmitter)
    
    // Create a multiplier gadget
    const mult = new ContactGroupImpl('mult1', '*', { x: 200, y: 100 }, eventEmitter)
    rootGroup.addSubgroup(mult)
    
    // Create boundary contacts
    const in1 = new BoundaryContactImpl('in1', { x: 0, y: 30 }, new AcceptLastValue(), eventEmitter)
    const out1 = new BoundaryContactImpl('out1', { x: 50, y: 30 }, new AcceptLastValue(), eventEmitter)
    
    mult.addContact(in1)
    mult.addContact(out1)
    
    // Create a regular contact to send input
    const sender = new ContactImpl('sender', { x: 50, y: 100 }, new AcceptLastValue(), eventEmitter)
    rootGroup.addContact(sender)
    
    // Create wire FROM sender TO input boundary
    const wire = new ContactGroupWireImpl('w1', 'sender', 'in1', rootGroup.id, eventEmitter)
    rootGroup.wires.set(wire.id, wire)
    
    // Convert to edges
    const edges = wiresToEdges(rootGroup)
    
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({
      id: 'w1',
      source: 'sender',
      target: 'mult1', // Target should be the gadget
      sourceHandle: undefined,
      targetHandle: 'in1-left-target', // Should be a TARGET handle on the LEFT
      type: 'contactWire'
    })
  })
})