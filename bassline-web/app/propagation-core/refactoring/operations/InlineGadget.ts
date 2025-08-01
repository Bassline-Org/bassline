import type { ContactGroup } from '../../models/ContactGroup'
import type { RefactoringResult } from '../types'
import { ConnectionValidator } from '../ConnectionValidator'

export class InlineGadgetOperation {
  private validator = new ConnectionValidator()
  
  execute(
    parentGroup: ContactGroup,
    gadgetId: string
  ): RefactoringResult {
    // Find the gadget to inline
    const gadget = parentGroup.subgroups.get(gadgetId)
    if (!gadget) {
      return {
        success: false,
        errors: ['Gadget not found']
      }
    }
    
    // Track what we're moving for the result
    const movedContacts: string[] = []
    const removedBoundaries: string[] = []
    
    // Map boundary contacts to their connections in parent
    const boundaryToParentWires = new Map<string, Array<{wireId: string, externalId: string, type: 'incoming' | 'outgoing'}>>()
    
    // Find all wires in parent that connect to gadget's boundary contacts
    for (const [wireId, wire] of parentGroup.wires) {
      // Check if wire connects to a boundary contact
      if (gadget.boundaryContacts.has(wire.fromId)) {
        const existing = boundaryToParentWires.get(wire.fromId) || []
        existing.push({ wireId, externalId: wire.toId, type: 'outgoing' })
        boundaryToParentWires.set(wire.fromId, existing)
      }
      if (gadget.boundaryContacts.has(wire.toId)) {
        const existing = boundaryToParentWires.get(wire.toId) || []
        existing.push({ wireId, externalId: wire.fromId, type: 'incoming' })
        boundaryToParentWires.set(wire.toId, existing)
      }
    }
    
    // Move all internal (non-boundary) contacts to parent
    for (const [contactId, contact] of gadget.contacts) {
      if (!gadget.boundaryContacts.has(contactId)) {
        // Create new contact in parent with same properties
        // Adjust position by gadget position
        const adjustedPosition = {
          x: gadget.position.x + contact.position.x,
          y: gadget.position.y + contact.position.y
        }
        const newContact = parentGroup.addContact(adjustedPosition)
        newContact.setContent(contact.content)
        newContact.blendMode = contact.blendMode
        
        // Update tracking
        movedContacts.push(newContact.id)
        
        // We'll need to remap wires from old ID to new ID
        // Store mapping for wire remapping
        const anyContact = contact as any
        anyContact.__newId = newContact.id
      }
    }
    
    // Move and remap internal wires
    for (const [wireId, wire] of gadget.wires) {
      const fromContact = gadget.contacts.get(wire.fromId)
      const toContact = gadget.contacts.get(wire.toId)
      
      if (!fromContact || !toContact) continue
      
      // Determine new wire endpoints
      let newFromId = wire.fromId
      let newToId = wire.toId
      
      // If from is internal (not boundary), use its new ID
      if (!gadget.boundaryContacts.has(wire.fromId) && (fromContact as any).__newId) {
        newFromId = (fromContact as any).__newId
      }
      
      // If to is internal (not boundary), use its new ID
      if (!gadget.boundaryContacts.has(wire.toId) && (toContact as any).__newId) {
        newToId = (toContact as any).__newId
      }
      
      // Handle wires that connect to boundary contacts
      if (gadget.boundaryContacts.has(wire.fromId)) {
        // This is: boundary -> internal
        // Need to rewire: external -> internal (skip the boundary)
        const parentConnections = boundaryToParentWires.get(wire.fromId) || []
        for (const conn of parentConnections) {
          if (conn.type === 'incoming') {
            // Create direct connection from external to internal
            parentGroup.connect(conn.externalId, newToId, wire.type)
          }
        }
      } else if (gadget.boundaryContacts.has(wire.toId)) {
        // This is: internal -> boundary  
        // Need to rewire: internal -> external (skip the boundary)
        const parentConnections = boundaryToParentWires.get(wire.toId) || []
        for (const conn of parentConnections) {
          if (conn.type === 'outgoing') {
            // Create direct connection from internal to external
            parentGroup.connect(newFromId, conn.externalId, wire.type)
          }
        }
      } else {
        // Both endpoints are internal - just recreate in parent
        parentGroup.connect(newFromId, newToId, wire.type)
      }
    }
    
    // Remove boundary contacts and their parent wires
    for (const boundaryId of gadget.boundaryContacts) {
      removedBoundaries.push(boundaryId)
      
      // Remove parent wires that connected to this boundary
      const parentConnections = boundaryToParentWires.get(boundaryId) || []
      for (const conn of parentConnections) {
        parentGroup.wires.delete(conn.wireId)
      }
    }
    
    // Remove the now-empty gadget
    parentGroup.subgroups.delete(gadgetId)
    
    return {
      success: true,
      affectedContacts: movedContacts,
      affectedWires: [] // Could track these if needed
    }
  }
}