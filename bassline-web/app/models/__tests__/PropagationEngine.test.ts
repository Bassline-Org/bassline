import { describe, it, expect, beforeEach } from 'vitest'
import { ContactGroupImpl } from '../ContactGroup'
import { ContactImpl } from '../Contact'
import { BoundaryContactImpl } from '../BoundaryContact'
import { ContactGroupWireImpl } from '../ContactGroupWire'
import { PropagationEngine } from '../PropagationEngine'
import { AcceptLastValue } from '../blendModes'
import { EventEmitter } from '../../utils/EventEmitter'

describe('PropagationEngine - Connection Tests', () => {
  let eventEmitter: EventEmitter
  let engine: PropagationEngine
  let rootGroup: ContactGroupImpl
  
  beforeEach(() => {
    eventEmitter = new EventEmitter()
    engine = new PropagationEngine(eventEmitter)
    rootGroup = new ContactGroupImpl(
      'root-id',
      'Root Group',
      { x: 0, y: 0 },
      eventEmitter
    )
  })

  describe('Contact to Contact connections', () => {
    it('should create a wire between two contacts in the same group', () => {
      // Create two contacts
      const contact1 = new ContactImpl(
        'contact-1',
        { x: 0, y: 0 },
        new AcceptLastValue(),
        eventEmitter
      )
      const contact2 = new ContactImpl(
        'contact-2',
        { x: 100, y: 0 },
        new AcceptLastValue(),
        eventEmitter
      )
      
      rootGroup.addContact(contact1)
      rootGroup.addContact(contact2)
      
      // Create a wire
      const wire = new ContactGroupWireImpl(
        'wire-1',
        contact1.id,
        contact2.id,
        rootGroup.id,
        eventEmitter
      )
      
      rootGroup.addWire(wire)
      
      // Verify wire exists
      expect(rootGroup.wires.has(wire.id)).toBe(true)
      expect(rootGroup.wires.get(wire.id)?.from).toBe(contact1.id)
      expect(rootGroup.wires.get(wire.id)?.to).toBe(contact2.id)
    })

    it('should propagate values through wires', () => {
      // Create two contacts
      const contact1 = new ContactImpl(
        'contact-1',
        { x: 0, y: 0 },
        new AcceptLastValue(),
        eventEmitter
      )
      const contact2 = new ContactImpl(
        'contact-2',
        { x: 100, y: 0 },
        new AcceptLastValue(),
        eventEmitter
      )
      
      rootGroup.addContact(contact1)
      rootGroup.addContact(contact2)
      
      // Create a wire
      const wire = new ContactGroupWireImpl(
        'wire-1',
        contact1.id,
        contact2.id,
        rootGroup.id,
        eventEmitter
      )
      
      rootGroup.addWire(wire)
      
      // Set value on contact1 and propagate
      contact1.setContent('test-value')
      engine.propagateFromContact(contact1, rootGroup)
      
      // Verify contact2 received the value
      expect(contact2.content?.value).toBe('test-value')
    })
  })

  describe('Contact to Gadget connections', () => {
    it('should create a wire to a boundary contact in a subgroup', () => {
      // Create a subgroup (gadget)
      const subgroup = new ContactGroupImpl(
        'subgroup-1',
        'Adder',
        { x: 200, y: 0 },
        eventEmitter
      )
      rootGroup.addSubgroup(subgroup)
      
      // Create boundary contacts in the subgroup
      const inputBoundary = new BoundaryContactImpl(
        'boundary-1',
        { x: 0, y: 25 },
        new AcceptLastValue(),
        eventEmitter
      )
      const outputBoundary = new BoundaryContactImpl(
        'boundary-2',
        { x: 50, y: 25 },
        new AcceptLastValue(),
        eventEmitter
      )
      
      subgroup.addContact(inputBoundary)
      subgroup.addContact(outputBoundary)
      
      // Create a regular contact in the root group
      const contact = new ContactImpl(
        'contact-1',
        { x: 0, y: 0 },
        new AcceptLastValue(),
        eventEmitter
      )
      rootGroup.addContact(contact)
      
      // Create a wire from contact to boundary
      const wire = new ContactGroupWireImpl(
        'wire-1',
        contact.id,
        inputBoundary.id,
        rootGroup.id,
        eventEmitter
      )
      
      rootGroup.addWire(wire)
      
      // Verify wire exists
      expect(rootGroup.wires.has(wire.id)).toBe(true)
      expect(rootGroup.wires.get(wire.id)?.from).toBe(contact.id)
      expect(rootGroup.wires.get(wire.id)?.to).toBe(inputBoundary.id)
    })

    it('should find boundary contacts in subgroups when creating wires', () => {
      // Create a subgroup
      const subgroup = new ContactGroupImpl(
        'subgroup-1',
        'Multiplier',
        { x: 200, y: 0 },
        eventEmitter
      )
      rootGroup.addSubgroup(subgroup)
      
      // Create boundary contact in the subgroup
      const boundary = new BoundaryContactImpl(
        'boundary-1',
        { x: 0, y: 25 },
        new AcceptLastValue(),
        eventEmitter
      )
      subgroup.addContact(boundary)
      
      // Create a regular contact
      const contact = new ContactImpl(
        'contact-1',
        { x: 0, y: 0 },
        new AcceptLastValue(),
        eventEmitter
      )
      rootGroup.addContact(contact)
      
      // Helper function to find contacts (simulating what createWire does)
      const findContact = (id: string): ContactImpl | BoundaryContactImpl | undefined => {
        // Check in current group
        let found = rootGroup.contacts.get(id)
        if (found) return found as ContactImpl | BoundaryContactImpl
        
        // Check in subgroups
        for (const sg of rootGroup.subgroups.values()) {
          found = sg.contacts.get(id)
          if (found) return found as ContactImpl | BoundaryContactImpl
        }
        
        return undefined
      }
      
      // Verify we can find both contacts
      expect(findContact(contact.id)).toBeDefined()
      expect(findContact(boundary.id)).toBeDefined()
      expect(findContact(boundary.id)?.isBoundary()).toBe(true)
    })
  })

  describe('Edge rendering for React Flow', () => {
    it('should map wires to edges with correct node IDs for boundary contacts', () => {
      // Create a subgroup
      const subgroup = new ContactGroupImpl(
        'subgroup-1',
        'Gadget',
        { x: 200, y: 0 },
        eventEmitter
      )
      rootGroup.addSubgroup(subgroup)
      
      // Create boundary and regular contacts
      const boundary = new BoundaryContactImpl(
        'boundary-1',
        { x: 0, y: 25 },
        new AcceptLastValue(),
        eventEmitter
      )
      subgroup.addContact(boundary)
      
      const contact = new ContactImpl(
        'contact-1',
        { x: 0, y: 0 },
        new AcceptLastValue(),
        eventEmitter
      )
      rootGroup.addContact(contact)
      
      // Create wire
      const wire = new ContactGroupWireImpl(
        'wire-1',
        contact.id,
        boundary.id,
        rootGroup.id,
        eventEmitter
      )
      rootGroup.addWire(wire)
      
      // Simulate edge mapping logic
      const edges: any[] = []
      rootGroup.wires.forEach((w) => {
        let sourceNodeId = w.from
        let targetNodeId = w.to
        let sourceHandle = undefined
        let targetHandle = undefined
        
        // Check if source/target are boundary contacts in subgroups
        rootGroup.subgroups.forEach(sg => {
          const sourceContact = sg.contacts.get(w.from)
          const targetContact = sg.contacts.get(w.to)
          
          if (sourceContact && sourceContact.isBoundary && sourceContact.isBoundary()) {
            sourceNodeId = sg.id
            sourceHandle = `${w.from}-right-source`
          }
          
          if (targetContact && targetContact.isBoundary && targetContact.isBoundary()) {
            targetNodeId = sg.id
            targetHandle = `${w.to}-left-target`
          }
        })
        
        edges.push({
          id: w.id,
          source: sourceNodeId,
          target: targetNodeId,
          sourceHandle,
          targetHandle,
        })
      })
      
      // Verify edge mapping
      expect(edges).toHaveLength(1)
      expect(edges[0].source).toBe(contact.id) // Regular contact uses its own ID
      expect(edges[0].target).toBe(subgroup.id) // Boundary contact uses subgroup ID
      expect(edges[0].targetHandle).toBe(`${boundary.id}-left-target`)
    })
  })
})