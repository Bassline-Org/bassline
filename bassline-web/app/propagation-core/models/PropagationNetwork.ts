import type { ContactId, WireId, Position } from '../types'
import { ContactGroup } from './ContactGroup'
import { Contact } from './Contact'
import { Wire } from './Wire'

export class PropagationNetwork {
  rootGroup: ContactGroup
  
  constructor() {
    this.rootGroup = new ContactGroup(crypto.randomUUID(), 'Root')
  }
  
  // Convenience methods that delegate to root group
  addContact(position: Position): Contact {
    return this.rootGroup.addContact(position)
  }
  
  addBoundaryContact(position: Position): Contact {
    return this.rootGroup.addBoundaryContact(position)
  }
  
  connect(fromId: ContactId, toId: ContactId, type: 'bidirectional' | 'directed' = 'bidirectional'): Wire {
    return this.rootGroup.connect(fromId, toId, type)
  }
  
  createGroup(name: string): ContactGroup {
    return this.rootGroup.createSubgroup(name)
  }
  
  findContact(id: ContactId): Contact | undefined {
    return this.rootGroup.findContact(id)
  }
  
  // Get all contacts and wires for current view (root level)
  getCurrentView(): { contacts: Contact[], wires: Wire[] } {
    return {
      contacts: Array.from(this.rootGroup.contacts.values()),
      wires: Array.from(this.rootGroup.wires.values())
    }
  }
  
  // Deletion methods
  removeContact(contactId: ContactId): boolean {
    return this.rootGroup.removeContact(contactId)
  }
  
  removeWire(wireId: WireId): boolean {
    return this.rootGroup.removeWire(wireId)
  }
}