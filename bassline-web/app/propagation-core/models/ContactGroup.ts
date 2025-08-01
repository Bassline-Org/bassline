import type { ContactId, WireId, GroupId, Position } from '../types'
import { Contradiction } from '../types'
import { Contact } from './Contact'
import { Wire } from './Wire'

const generateId = (): string => crypto.randomUUID()

export class ContactGroup {
  contacts = new Map<ContactId, Contact>()
  wires = new Map<WireId, Wire>()
  boundaryContacts = new Set<ContactId>()
  subgroups = new Map<GroupId, ContactGroup>()
  
  constructor(
    public readonly id: GroupId,
    public name: string,
    public parent?: ContactGroup
  ) {}
  
  // Factory methods
  addContact(position: Position): Contact {
    const contact = new Contact(generateId(), position, this)
    this.contacts.set(contact.id, contact)
    return contact
  }
  
  addBoundaryContact(position: Position): Contact {
    const contact = this.addContact(position)
    this.boundaryContacts.add(contact.id)
    return contact
  }
  
  connect(fromId: ContactId, toId: ContactId, type: 'bidirectional' | 'directed' = 'bidirectional'): Wire {
    const wire = new Wire(generateId(), fromId, toId, type)
    this.wires.set(wire.id, wire)
    return wire
  }
  
  createSubgroup(name: string): ContactGroup {
    const subgroup = new ContactGroup(generateId(), name, this)
    this.subgroups.set(subgroup.id, subgroup)
    return subgroup
  }
  
  // Connection queries
  getOutgoingConnections(contactId: ContactId): Array<{ wire: Wire; targetId: ContactId }> {
    const connections: Array<{ wire: Wire; targetId: ContactId }> = []
    
    for (const wire of this.wires.values()) {
      if (wire.type === 'bidirectional') {
        if (wire.fromId === contactId) {
          connections.push({ wire, targetId: wire.toId })
        } else if (wire.toId === contactId) {
          connections.push({ wire, targetId: wire.fromId })
        }
      } else if (wire.type === 'directed' && wire.fromId === contactId) {
        connections.push({ wire, targetId: wire.toId })
      }
    }
    
    return connections
  }
  
  // Content delivery
  deliverContent(contactId: ContactId, content: any, sourceId: ContactId): void {
    const contact = this.findContact(contactId)
    if (contact) {
      contact.setContent(content, sourceId)
    }
  }
  
  // Hierarchy navigation
  findContact(id: ContactId): Contact | undefined {
    // Check own contacts
    if (this.contacts.has(id)) {
      return this.contacts.get(id)
    }
    
    // Check subgroups recursively
    for (const subgroup of this.subgroups.values()) {
      const found = subgroup.findContact(id)
      if (found) return found
    }
    
    // Check parent boundary contacts if we're looking from inside
    if (this.parent && this.parent.boundaryContacts.has(id)) {
      return this.parent.contacts.get(id)
    }
    
    return undefined
  }
  
  // Event handling
  handleContradiction(contactId: ContactId, contradiction: Contradiction): void {
    console.warn(`Contradiction at contact ${contactId}: ${contradiction.reason}`)
    // Could emit an event here for UI to handle
  }
  
  // Deletion methods
  removeContact(contactId: ContactId): boolean {
    if (!this.contacts.has(contactId)) {
      // Try subgroups
      for (const subgroup of this.subgroups.values()) {
        if (subgroup.removeContact(contactId)) {
          return true
        }
      }
      return false
    }
    
    // Remove all wires connected to this contact
    const wiresToRemove: WireId[] = []
    for (const [wireId, wire] of this.wires) {
      if (wire.fromId === contactId || wire.toId === contactId) {
        wiresToRemove.push(wireId)
      }
    }
    
    // Remove the wires
    for (const wireId of wiresToRemove) {
      this.wires.delete(wireId)
    }
    
    // Remove from boundary set if it's there
    this.boundaryContacts.delete(contactId)
    
    // Remove the contact
    this.contacts.delete(contactId)
    return true
  }
  
  removeWire(wireId: WireId): boolean {
    if (this.wires.delete(wireId)) {
      return true
    }
    
    // Try subgroups
    for (const subgroup of this.subgroups.values()) {
      if (subgroup.removeWire(wireId)) {
        return true
      }
    }
    
    return false
  }
}