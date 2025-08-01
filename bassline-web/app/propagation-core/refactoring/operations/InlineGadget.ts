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
    
    // Move nested subgroups (gadgets) to parent - only one level!
    for (const [subgroupId, subgroup] of gadget.subgroups) {
      // Adjust position by parent gadget position
      const adjustedPosition = {
        x: gadget.position.x + subgroup.position.x,
        y: gadget.position.y + subgroup.position.y
      }
      subgroup.position = adjustedPosition
      
      // Move subgroup to parent
      parentGroup.subgroups.set(subgroupId, subgroup)
      subgroup.parent = parentGroup
      
      // The subgroup keeps all its internal structure intact
      // We only need to handle connections from gadget's contacts to this subgroup's boundaries
    }
    
    // IMPORTANT: We need to handle parent wires that connect to moved subgroups' boundaries
    // These wires were connecting: parent contact -> gadget boundary -> subgroup boundary
    // After inlining, they should connect: parent contact -> subgroup boundary directly
    const parentWiresToUpdate: Array<{wireId: string, wire: any}> = []
    
    for (const [wireId, wire] of parentGroup.wires) {
      // Check if this wire connects through a gadget boundary to a subgroup boundary
      const gadgetBoundary = gadget.boundaryContacts.has(wire.toId) ? wire.toId : 
                            gadget.boundaryContacts.has(wire.fromId) ? wire.fromId : null
                            
      if (gadgetBoundary) {
        // Find if there's an internal wire from this boundary to a subgroup boundary
        for (const [internalWireId, internalWire] of gadget.wires) {
          let shouldUpdate = false
          let externalContactId: string | null = null
          let subgroupBoundaryId: string | null = null
          
          // Check if internal wire connects gadget boundary to subgroup boundary
          if (internalWire.fromId === gadgetBoundary) {
            // Check if target is a subgroup boundary
            for (const [subgroupId, subgroup] of gadget.subgroups) {
              if (subgroup.boundaryContacts.has(internalWire.toId)) {
                shouldUpdate = true
                externalContactId = wire.fromId === gadgetBoundary ? wire.toId : wire.fromId
                subgroupBoundaryId = internalWire.toId
                break
              }
            }
          } else if (internalWire.toId === gadgetBoundary) {
            // Check if source is a subgroup boundary
            for (const [subgroupId, subgroup] of gadget.subgroups) {
              if (subgroup.boundaryContacts.has(internalWire.fromId)) {
                shouldUpdate = true
                externalContactId = wire.fromId === gadgetBoundary ? wire.toId : wire.fromId
                subgroupBoundaryId = internalWire.fromId
                break
              }
            }
          }
          
          if (shouldUpdate && externalContactId && subgroupBoundaryId) {
            // Queue this parent wire for update
            parentWiresToUpdate.push({ wireId, wire })
            
            // Create new direct connection
            if (wire.fromId === gadgetBoundary) {
              // Was: external -> gadget boundary, now: external -> subgroup boundary
              parentGroup.connect(externalContactId, subgroupBoundaryId, wire.type)
            } else {
              // Was: gadget boundary -> external, now: subgroup boundary -> external
              parentGroup.connect(subgroupBoundaryId, externalContactId, wire.type)
            }
          }
        }
      }
    }
    
    // Move and remap internal wires
    for (const [wireId, wire] of gadget.wires) {
      const fromContact = gadget.contacts.get(wire.fromId)
      const toContact = gadget.contacts.get(wire.toId)
      
      // Check if wire connects to a boundary contact of a moved subgroup
      let fromIsSubgroupBoundary = false
      let toIsSubgroupBoundary = false
      
      for (const [subgroupId, subgroup] of gadget.subgroups) {
        if (subgroup.boundaryContacts.has(wire.fromId)) {
          fromIsSubgroupBoundary = true
        }
        if (subgroup.boundaryContacts.has(wire.toId)) {
          toIsSubgroupBoundary = true
        }
      }
      
      // Skip if both endpoints are missing (shouldn't happen)
      if (!fromContact && !toContact && !fromIsSubgroupBoundary && !toIsSubgroupBoundary) continue
      
      // Determine new wire endpoints
      let newFromId = wire.fromId
      let newToId = wire.toId
      
      // If from is internal (not boundary), use its new ID
      if (fromContact && !gadget.boundaryContacts.has(wire.fromId) && (fromContact as any).__newId) {
        newFromId = (fromContact as any).__newId
      }
      
      // If to is internal (not boundary), use its new ID
      if (toContact && !gadget.boundaryContacts.has(wire.toId) && (toContact as any).__newId) {
        newToId = (toContact as any).__newId
      }
      
      // Handle wires that connect to boundary contacts of the gadget being inlined
      if (gadget.boundaryContacts.has(wire.fromId)) {
        // This is: boundary -> internal/subgroup
        // Need to rewire: external -> internal/subgroup (skip the boundary)
        const parentConnections = boundaryToParentWires.get(wire.fromId) || []
        for (const conn of parentConnections) {
          if (conn.type === 'incoming') {
            // Create direct connection from external to internal
            parentGroup.connect(conn.externalId, newToId, wire.type)
          }
        }
      } else if (gadget.boundaryContacts.has(wire.toId)) {
        // This is: internal/subgroup -> boundary  
        // Need to rewire: internal/subgroup -> external (skip the boundary)
        const parentConnections = boundaryToParentWires.get(wire.toId) || []
        for (const conn of parentConnections) {
          if (conn.type === 'outgoing') {
            // Create direct connection from internal to external
            parentGroup.connect(newFromId, conn.externalId, wire.type)
          }
        }
      } else if (!fromIsSubgroupBoundary && !toIsSubgroupBoundary) {
        // Both endpoints are internal contacts (not subgroup boundaries) - recreate in parent
        parentGroup.connect(newFromId, newToId, wire.type)
      } else {
        // At least one endpoint is a subgroup boundary - recreate in parent as-is
        // The subgroup boundaries maintain their IDs, so the connection remains valid
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
    
    // Also remove the parent wires we updated/replaced
    for (const { wireId } of parentWiresToUpdate) {
      parentGroup.wires.delete(wireId)
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