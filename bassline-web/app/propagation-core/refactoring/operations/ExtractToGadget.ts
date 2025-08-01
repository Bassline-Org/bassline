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
    if (selection.contacts.size === 0) {
      return {
        success: false,
        errors: ['No contacts selected']
      }
    }
    
    // Create new gadget
    const gadget = parentGroup.createSubgroup(gadgetName)
    gadget.position = position
    
    // Classify wires
    const allWires = Array.from(parentGroup.wires.values())
    const classification = this.classifier.classify(allWires, selection)
    
    // Move selected contacts to gadget
    const movedContacts = new Map<string, string>() // old id -> new id
    selection.contacts.forEach(contactId => {
      const contact = parentGroup.contacts.get(contactId)
      if (contact) {
        // Create new contact in gadget with same properties
        const newContact = gadget.addContact(contact.position)
        newContact.setContent(contact.content)
        newContact.blendMode = contact.blendMode
        movedContacts.set(contactId, newContact.id)
        
        // Remove from parent
        parentGroup.contacts.delete(contactId)
      }
    })
    
    // Handle internal wires - just recreate in gadget
    classification.internal.forEach(wire => {
      const newFromId = movedContacts.get(wire.fromId)!
      const newToId = movedContacts.get(wire.toId)!
      gadget.connect(newFromId, newToId, wire.type)
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
        const internalId = movedContacts.get(wire.toId)!
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
        const internalId = movedContacts.get(wire.fromId)!
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