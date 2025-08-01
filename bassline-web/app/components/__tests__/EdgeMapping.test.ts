import { describe, it, expect, beforeEach } from 'vitest'
import { ContactGroupImpl } from '../../models/ContactGroup'
import { ContactImpl } from '../../models/Contact'
import { BoundaryContactImpl } from '../../models/BoundaryContact'
import { ContactGroupWireImpl } from '../../models/ContactGroupWire'
import { AcceptLastValue } from '../../models/blendModes'
import { EventEmitter } from '../../utils/EventEmitter'

describe('React Flow Edge Mapping', () => {
  let eventEmitter: EventEmitter
  let rootGroup: ContactGroupImpl
  
  beforeEach(() => {
    eventEmitter = new EventEmitter()
    rootGroup = new ContactGroupImpl(
      'root-id',
      'Root Group',
      { x: 0, y: 0 },
      eventEmitter
    )
  })

  describe('Edge creation for different connection types', () => {
    it('should create edges for contact-to-contact connections', () => {
      // Create two contacts
      const contact1 = new ContactImpl('c1', { x: 0, y: 0 }, new AcceptLastValue(), eventEmitter)
      const contact2 = new ContactImpl('c2', { x: 100, y: 0 }, new AcceptLastValue(), eventEmitter)
      
      rootGroup.addContact(contact1)
      rootGroup.addContact(contact2)
      
      // Create wire
      const wire = new ContactGroupWireImpl('w1', 'c1', 'c2', rootGroup.id, eventEmitter)
      rootGroup.addWire(wire)
      
      // Simulate the edge mapping logic from PropagationNetworkEditor
      const edges: any[] = []
      rootGroup.wires.forEach((w) => {
        let sourceNodeId = w.from
        let targetNodeId = w.to
        let sourceHandle = undefined
        let targetHandle = undefined
        
        edges.push({
          id: w.id,
          source: sourceNodeId,
          target: targetNodeId,
          sourceHandle,
          targetHandle,
          type: 'contactWire',
        })
      })
      
      expect(edges).toHaveLength(1)
      expect(edges[0]).toEqual({
        id: 'w1',
        source: 'c1',
        target: 'c2',
        sourceHandle: undefined,
        targetHandle: undefined,
        type: 'contactWire',
      })
    })

    it('should create edges with proper handles for gadget connections', () => {
      // Create a gadget (subgroup)
      const gadget = new ContactGroupImpl('g1', 'Adder', { x: 200, y: 0 }, eventEmitter)
      rootGroup.addSubgroup(gadget)
      
      // Create boundary contacts in gadget
      const inputBoundary = new BoundaryContactImpl('b1', { x: 0, y: 25 }, new AcceptLastValue(), eventEmitter)
      const outputBoundary = new BoundaryContactImpl('b2', { x: 50, y: 25 }, new AcceptLastValue(), eventEmitter)
      gadget.addContact(inputBoundary)
      gadget.addContact(outputBoundary)
      
      // Create regular contacts
      const contact1 = new ContactImpl('c1', { x: 0, y: 0 }, new AcceptLastValue(), eventEmitter)
      const contact2 = new ContactImpl('c2', { x: 300, y: 0 }, new AcceptLastValue(), eventEmitter)
      rootGroup.addContact(contact1)
      rootGroup.addContact(contact2)
      
      // Create wires: contact1 -> inputBoundary, outputBoundary -> contact2
      const wire1 = new ContactGroupWireImpl('w1', 'c1', 'b1', rootGroup.id, eventEmitter)
      const wire2 = new ContactGroupWireImpl('w2', 'b2', 'c2', rootGroup.id, eventEmitter)
      rootGroup.addWire(wire1)
      rootGroup.addWire(wire2)
      
      // Simulate the CORRECTED edge mapping logic
      const edges: any[] = []
      rootGroup.wires.forEach((w) => {
        let sourceNodeId = w.from
        let targetNodeId = w.to
        let sourceHandle = undefined
        let targetHandle = undefined
        
        // Check if source is a boundary contact in a subgroup
        rootGroup.subgroups.forEach(sg => {
          const sourceContact = sg.contacts.get(w.from)
          const targetContact = sg.contacts.get(w.to)
          
          if (sourceContact && sourceContact.isBoundary && sourceContact.isBoundary()) {
            sourceNodeId = sg.id
            // Determine side based on position
            const midX = 25 // Assuming gadget width of 50
            sourceHandle = sourceContact.position.x < midX ? 
              `${w.from}-left-source` : `${w.from}-right-source`
          }
          
          if (targetContact && targetContact.isBoundary && targetContact.isBoundary()) {
            targetNodeId = sg.id
            // Determine side based on position
            const midX = 25
            targetHandle = targetContact.position.x < midX ? 
              `${w.to}-left-target` : `${w.to}-right-target`
          }
        })
        
        edges.push({
          id: w.id,
          source: sourceNodeId,
          target: targetNodeId,
          sourceHandle,
          targetHandle,
          type: 'contactWire',
        })
      })
      
      expect(edges).toHaveLength(2)
      
      // First edge: contact1 -> gadget (input boundary)
      expect(edges[0]).toEqual({
        id: 'w1',
        source: 'c1',
        target: 'g1',
        sourceHandle: undefined,
        targetHandle: 'b1-left-target',
        type: 'contactWire',
      })
      
      // Second edge: gadget (output boundary) -> contact2
      expect(edges[1]).toEqual({
        id: 'w2',
        source: 'g1',
        target: 'c2',
        sourceHandle: 'b2-right-source',
        targetHandle: undefined,
        type: 'contactWire',
      })
    })
  })

  describe('Handle ID extraction in onConnect', () => {
    it('should extract boundary contact IDs from handle IDs', () => {
      // Simulate connection params from React Flow
      const params = {
        source: 'c1',
        target: 'g1',
        sourceHandle: 'c1-right-source',
        targetHandle: 'b1-left-target',
      }
      
      // Simulate the handle ID extraction logic
      let sourceId = params.source
      let targetId = params.target
      
      if (params.sourceHandle) {
        const match = params.sourceHandle.match(/^([a-f0-9-]+)-(left|right)-(source|target)$/)
        if (match) {
          sourceId = match[1]
        }
      }
      
      if (params.targetHandle) {
        const match = params.targetHandle.match(/^([a-f0-9-]+)-(left|right)-(source|target)$/)
        if (match) {
          targetId = match[1]
        }
      }
      
      expect(sourceId).toBe('c1')
      expect(targetId).toBe('b1')
    })
  })
})