import type { ContactGroup } from '../../models/ContactGroup'
import type { Selection, RefactoringResult } from '../types'
import type { Position } from '../../types'
import { WireClassifier } from '../WireClassifier'
import { ConnectionValidator } from '../ConnectionValidator'

export class ExtractToGadgetOperation {
  private classifier = new WireClassifier()
  private validator = new ConnectionValidator()
  
  execute(
    parentGroup: ContactGroup,
    selection: Selection,
    gadgetName: string,
    position: Position = { x: 100, y: 100 }
  ): RefactoringResult {
    // Validate selection
    if (selection.contacts.size === 0 && selection.groups.size === 0) {
      return {
        success: false,
        errors: ['No contacts or gadgets selected']
      }
    }
    
    // Create new gadget
    const gadget = parentGroup.createSubgroup(gadgetName)
    gadget.position = position
    
    // First, move any selected subgroups into the new gadget
    const movedGroups = new Set<string>()
    selection.groups.forEach(groupId => {
      const subgroup = parentGroup.subgroups.get(groupId)
      if (subgroup) {
        // Move the entire subgroup into the new gadget
        gadget.subgroups.set(groupId, subgroup)
        parentGroup.subgroups.delete(groupId)
        subgroup.parent = gadget
        movedGroups.add(groupId)
        
        // Add all boundary contacts of moved groups to our selection
        // so they're considered when classifying wires
        subgroup.boundaryContacts.forEach(contactId => {
          selection.contacts.add(contactId)
        })
      }
    })
    
    // Classify wires
    const allWires = Array.from(parentGroup.wires.values())
    const classification = this.classifier.classify(allWires, selection)
    
    // Move selected contacts to gadget (but not those in moved subgroups)
    const movedContacts = new Map<string, string>() // old id -> new id
    selection.contacts.forEach(contactId => {
      const contact = parentGroup.contacts.get(contactId)
      if (contact) {
        // Skip if this contact belongs to a moved subgroup
        let belongsToMovedGroup = false
        movedGroups.forEach(groupId => {
          const group = gadget.subgroups.get(groupId)
          if (group && (group.contacts.has(contactId) || group.boundaryContacts.has(contactId))) {
            belongsToMovedGroup = true
          }
        })
        
        if (!belongsToMovedGroup) {
          // Create new contact in gadget with same properties
          const newContact = gadget.addContact(contact.position)
          newContact.setContent(contact.content)
          newContact.blendMode = contact.blendMode
          movedContacts.set(contactId, newContact.id)
          
          // Remove from parent
          parentGroup.contacts.delete(contactId)
        }
      }
    })
    
    // Handle internal wires - just recreate in gadget
    classification.internal.forEach(wire => {
      // Check if wire connects boundary contacts of moved groups
      let fromId = wire.fromId
      let toId = wire.toId
      
      // If endpoints were moved as individual contacts, use new IDs
      if (movedContacts.has(wire.fromId)) {
        fromId = movedContacts.get(wire.fromId)!
      }
      if (movedContacts.has(wire.toId)) {
        toId = movedContacts.get(wire.toId)!
      }
      
      // Only create wire if both endpoints exist in gadget
      // (boundary contacts of moved groups keep their IDs)
      gadget.connect(fromId, toId, wire.type)
      parentGroup.wires.delete(wire.id)
    })
    
    // Handle incoming wires - create input boundaries
    const incomingGroups = this.classifier.groupByExternalEndpoint(
      classification.incoming, 
      selection, 
      'incoming'
    )
    
    incomingGroups.forEach((wires, externalContactId) => {
      // Create one input boundary per external source
      const boundaryPos = this.calculateBoundaryPosition(wires, 'input')
      const boundary = gadget.addBoundaryContact(boundaryPos, 'input', `from_${externalContactId.slice(0, 6)}`)
      
      // Rewire in parent: external -> boundary
      parentGroup.connect(externalContactId, boundary.id, wires[0].type)
      
      // Wire inside gadget: boundary -> internal contacts
      wires.forEach(wire => {
        // Use new ID if contact was moved individually, otherwise keep original
        const internalId = movedContacts.get(wire.toId) || wire.toId
        gadget.connect(boundary.id, internalId, wire.type)
        parentGroup.wires.delete(wire.id)
      })
    })
    
    // Handle outgoing wires - create output boundaries
    const outgoingGroups = this.classifier.groupByExternalEndpoint(
      classification.outgoing,
      selection,
      'outgoing'
    )
    
    outgoingGroups.forEach((wires, externalContactId) => {
      // Create one output boundary per external target
      const boundaryPos = this.calculateBoundaryPosition(wires, 'output')
      const boundary = gadget.addBoundaryContact(boundaryPos, 'output', `to_${externalContactId.slice(0, 6)}`)
      
      // Wire inside gadget: internal contacts -> boundary
      wires.forEach(wire => {
        // Use new ID if contact was moved individually, otherwise keep original
        const internalId = movedContacts.get(wire.fromId) || wire.fromId
        gadget.connect(internalId, boundary.id, wire.type)
        parentGroup.wires.delete(wire.id)
      })
      
      // Rewire in parent: boundary -> external
      parentGroup.connect(boundary.id, externalContactId, wires[0].type)
    })
    
    return {
      success: true,
      affectedContacts: Array.from(movedContacts.keys()),
      newGroups: [gadget.id]
    }
  }
  
  private calculateBoundaryPosition(wires: any[], side: 'input' | 'output'): Position {
    // Simple positioning - could be improved
    const baseX = side === 'input' ? 50 : 350
    const index = Math.floor(Math.random() * 3) // Temporary
    return {
      x: baseX,
      y: 50 + index * 50
    }
  }
}