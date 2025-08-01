import { describe, it, expect, beforeEach } from 'vitest'
import { wiresToEdges } from '../EdgeRenderer'
import { ContactGroupImpl } from '../../../models/ContactGroup'
import { ContactImpl } from '../../../models/Contact'
import { BoundaryContactImpl } from '../../../models/BoundaryContact'
import { ContactGroupWireImpl } from '../../../models/ContactGroupWire'
import { AcceptLastValue } from '../../../models/blendModes'
import { EventEmitter } from '../../../utils/EventEmitter'

describe('EdgeRenderer', () => {
  let eventEmitter: EventEmitter
  let rootGroup: ContactGroupImpl
  
  beforeEach(() => {
    eventEmitter = new EventEmitter()
    rootGroup = new ContactGroupImpl('root', 'Root', { x: 0, y: 0 }, eventEmitter)
  })

  describe('wiresToEdges', () => {
    it('should convert simple contact-to-contact wires to edges', () => {
      // Create two contacts
      const c1 = new ContactImpl('c1', { x: 0, y: 0 }, new AcceptLastValue(), eventEmitter)
      const c2 = new ContactImpl('c2', { x: 100, y: 0 }, new AcceptLastValue(), eventEmitter)
      rootGroup.addContact(c1)
      rootGroup.addContact(c2)
      
      // Create wire
      const wire = new ContactGroupWireImpl('w1', 'c1', 'c2', rootGroup.id, eventEmitter)
      rootGroup.wires.set(wire.id, wire) // Add directly to avoid validation
      
      // Convert to edges
      const edges = wiresToEdges(rootGroup)
      
      expect(edges).toHaveLength(1)
      expect(edges[0]).toEqual({
        id: 'w1',
        source: 'c1',
        target: 'c2',
        sourceHandle: undefined,
        targetHandle: undefined,
        type: 'contactWire',
        markerEnd: { type: 'arrowclosed' },
        data: { wire }
      })
    })

    it('should handle wires to boundary contacts in subgroups', () => {
      // Create a subgroup (gadget)
      const gadget = new ContactGroupImpl('g1', 'Adder', { x: 200, y: 0 }, eventEmitter)
      rootGroup.addSubgroup(gadget)
      
      // Create boundary contacts with positions
      const leftBoundary = new BoundaryContactImpl('b1', { x: 10, y: 25 }, new AcceptLastValue(), eventEmitter)
      const rightBoundary = new BoundaryContactImpl('b2', { x: 40, y: 25 }, new AcceptLastValue(), eventEmitter)
      gadget.addContact(leftBoundary)
      gadget.addContact(rightBoundary)
      
      // Create regular contact
      const contact = new ContactImpl('c1', { x: 0, y: 0 }, new AcceptLastValue(), eventEmitter)
      rootGroup.addContact(contact)
      
      // Create wire from contact to left boundary
      const wire = new ContactGroupWireImpl('w1', 'c1', 'b1', rootGroup.id, eventEmitter)
      rootGroup.wires.set(wire.id, wire)
      
      // Convert to edges
      const edges = wiresToEdges(rootGroup)
      
      expect(edges).toHaveLength(1)
      expect(edges[0]).toEqual({
        id: 'w1',
        source: 'c1',
        target: 'g1', // Target is the gadget node
        sourceHandle: undefined,
        targetHandle: 'b1-left-target', // Left side handle
        type: 'contactWire',
        markerEnd: { type: 'arrowclosed' },
        data: { wire }
      })
    })

    it('should handle wires from boundary contacts in subgroups', () => {
      // Create a subgroup
      const gadget = new ContactGroupImpl('g1', 'Multiplier', { x: 100, y: 0 }, eventEmitter)
      rootGroup.addSubgroup(gadget)
      
      // Create boundary contacts
      const leftBoundary = new BoundaryContactImpl('b1', { x: 10, y: 25 }, new AcceptLastValue(), eventEmitter)
      const rightBoundary = new BoundaryContactImpl('b2', { x: 40, y: 25 }, new AcceptLastValue(), eventEmitter)
      gadget.addContact(leftBoundary)
      gadget.addContact(rightBoundary)
      
      // Create regular contact
      const contact = new ContactImpl('c1', { x: 300, y: 0 }, new AcceptLastValue(), eventEmitter)
      rootGroup.addContact(contact)
      
      // Create wire from right boundary to contact
      const wire = new ContactGroupWireImpl('w1', 'b2', 'c1', rootGroup.id, eventEmitter)
      rootGroup.wires.set(wire.id, wire)
      
      // Convert to edges
      const edges = wiresToEdges(rootGroup)
      
      expect(edges).toHaveLength(1)
      expect(edges[0]).toEqual({
        id: 'w1',
        source: 'g1', // Source is the gadget node
        target: 'c1',
        sourceHandle: 'b2-right-source', // Right side handle
        targetHandle: undefined,
        type: 'contactWire',
        markerEnd: { type: 'arrowclosed' },
        data: { wire }
      })
    })

    it('should determine left/right handles based on boundary positions', () => {
      // Create a gadget with multiple boundaries
      const gadget = new ContactGroupImpl('g1', 'Complex', { x: 100, y: 0 }, eventEmitter)
      rootGroup.addSubgroup(gadget)
      
      // Create boundaries at different X positions
      const b1 = new BoundaryContactImpl('b1', { x: 5, y: 20 }, new AcceptLastValue(), eventEmitter)
      const b2 = new BoundaryContactImpl('b2', { x: 15, y: 40 }, new AcceptLastValue(), eventEmitter)
      const b3 = new BoundaryContactImpl('b3', { x: 35, y: 20 }, new AcceptLastValue(), eventEmitter)
      const b4 = new BoundaryContactImpl('b4', { x: 45, y: 40 }, new AcceptLastValue(), eventEmitter)
      
      gadget.addContact(b1)
      gadget.addContact(b2)
      gadget.addContact(b3)
      gadget.addContact(b4)
      
      // Create contacts
      const c1 = new ContactImpl('c1', { x: 0, y: 0 }, new AcceptLastValue(), eventEmitter)
      const c2 = new ContactImpl('c2', { x: 200, y: 0 }, new AcceptLastValue(), eventEmitter)
      rootGroup.addContact(c1)
      rootGroup.addContact(c2)
      
      // Create wires
      const w1 = new ContactGroupWireImpl('w1', 'c1', 'b1', rootGroup.id, eventEmitter)
      const w2 = new ContactGroupWireImpl('w2', 'b4', 'c2', rootGroup.id, eventEmitter)
      rootGroup.wires.set(w1.id, w1)
      rootGroup.wires.set(w2.id, w2)
      
      // Convert to edges
      const edges = wiresToEdges(rootGroup)
      
      expect(edges).toHaveLength(2)
      
      // First wire: to leftmost boundary (b1 at x=5)
      expect(edges[0].targetHandle).toBe('b1-left-target')
      
      // Second wire: from rightmost boundary (b4 at x=45)
      expect(edges[1].sourceHandle).toBe('b4-right-source')
    })
  })
})