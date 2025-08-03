import type { ContactGroup } from '../../models/ContactGroup'
import type { Selection, RefactoringResult } from '../types'

export class ConvertToBoundaryOperation {
  execute(
    group: ContactGroup,
    selection: Selection
  ): RefactoringResult {
    const errors: string[] = []
    const convertedContacts: string[] = []
    
    // Only convert contacts that are not already boundaries
    for (const contactId of selection.contacts) {
      const contact = group.contacts.get(contactId)
      if (!contact) {
        errors.push(`Contact ${contactId} not found`)
        continue
      }
      
      if (group.boundaryContacts.has(contactId)) {
        // Already a boundary
        continue
      }
      
      // Convert to boundary contact
      group.boundaryContacts.add(contactId)
      contact.isBoundary = true
      
      // Try to infer direction based on connections
      let hasIncoming = false
      let hasOutgoing = false
      
      for (const wire of group.wires.values()) {
        if (wire.toId === contactId) hasIncoming = true
        if (wire.fromId === contactId) hasOutgoing = true
      }
      
      // If parent group exists, check parent connections too
      if (group.parent) {
        for (const wire of group.parent.wires.values()) {
          if (wire.toId === contactId) hasIncoming = true
          if (wire.fromId === contactId) hasOutgoing = true
        }
      }
      
      // Set direction based on connections (default to input if ambiguous)
      // A contact with only outgoing connections is an INPUT (it provides input to the gadget)
      // A contact with only incoming connections is an OUTPUT (it outputs from the gadget)
      if (!hasIncoming && hasOutgoing) {
        contact.boundaryDirection = 'input'
      } else if (hasIncoming && !hasOutgoing) {
        contact.boundaryDirection = 'output'
      } else {
        // Ambiguous or no connections - default to input
        contact.boundaryDirection = 'input'
      }
      
      convertedContacts.push(contactId)
    }
    
    if (errors.length > 0 && convertedContacts.length === 0) {
      return {
        success: false,
        errors
      }
    }
    
    return {
      success: true,
      affectedContacts: convertedContacts,
      errors: errors.length > 0 ? errors : undefined
    }
  }
}