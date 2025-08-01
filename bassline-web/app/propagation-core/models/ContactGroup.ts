import type { ContactId, WireId, GroupId, Position } from '../types'
import { Contradiction } from '../types'
import { Contact } from './Contact'
import { Wire } from './Wire'
import type { GadgetTemplate, ContactTemplate, WireTemplate } from '../types/template'

const generateId = (): string => crypto.randomUUID()

export class ContactGroup {
  contacts = new Map<ContactId, Contact>()
  wires = new Map<WireId, Wire>()
  boundaryContacts = new Set<ContactId>()
  subgroups = new Map<GroupId, ContactGroup>()
  position: Position = { x: 0, y: 0 }
  
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
  
  addBoundaryContact(position: Position, direction: 'input' | 'output' = 'input', name?: string): Contact {
    const contact = this.addContact(position)
    contact.isBoundary = true
    contact.boundaryDirection = direction
    contact.name = name
    this.boundaryContacts.add(contact.id)
    return contact
  }
  
  getBoundaryContacts(): { inputs: Contact[], outputs: Contact[] } {
    const inputs: Contact[] = []
    const outputs: Contact[] = []
    
    for (const contactId of this.boundaryContacts) {
      const contact = this.contacts.get(contactId)
      if (contact) {
        if (contact.boundaryDirection === 'output') {
          outputs.push(contact)
        } else {
          inputs.push(contact)
        }
      }
    }
    
    return { inputs, outputs }
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
  
  // Check if a contact can be connected to (including boundary contacts in subgroups)
  canConnectTo(contactId: ContactId): Contact | undefined {
    // First check own contacts
    const ownContact = this.contacts.get(contactId)
    if (ownContact) return ownContact
    
    // Then check boundary contacts in immediate subgroups
    for (const subgroup of this.subgroups.values()) {
      if (subgroup.boundaryContacts.has(contactId)) {
        return subgroup.contacts.get(contactId)
      }
    }
    
    return undefined
  }
  
  // Content delivery
  deliverContent(contactId: ContactId, content: any, sourceId: ContactId): void {
    // Use canConnectTo to find the contact (includes boundary contacts in subgroups)
    const contact = this.canConnectTo(contactId)
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
  
  removeSubgroup(subgroupId: string): boolean {
    const subgroup = this.subgroups.get(subgroupId)
    if (!subgroup) {
      return false
    }
    
    // Remove all wires that connect to this subgroup's boundary contacts
    const wiresToRemove: WireId[] = []
    for (const [wireId, wire] of this.wires) {
      if (subgroup.boundaryContacts.has(wire.fromId) || subgroup.boundaryContacts.has(wire.toId)) {
        wiresToRemove.push(wireId)
      }
    }
    
    // Remove the wires
    wiresToRemove.forEach(wireId => this.wires.delete(wireId))
    
    // Remove the subgroup
    this.subgroups.delete(subgroupId)
    
    return true
  }
  
  // Template methods
  toTemplate(): GadgetTemplate {
    // Create a map from contact ID to index for wire mapping
    const contactIdToIndex = new Map<ContactId, number>()
    const contacts: ContactTemplate[] = []
    const boundaryIndices: number[] = []
    
    // Convert contacts to templates and build ID mapping
    let index = 0
    for (const contact of this.contacts.values()) {
      contactIdToIndex.set(contact.id, index)
      
      contacts.push({
        position: { ...contact.position },
        isBoundary: contact.isBoundary,
        boundaryDirection: contact.boundaryDirection,
        name: contact.name,
        blendMode: contact.blendMode
      })
      
      if (contact.isBoundary) {
        boundaryIndices.push(index)
      }
      
      index++
    }
    
    // Convert wires to templates using the ID mapping
    const wires: WireTemplate[] = []
    for (const wire of this.wires.values()) {
      const fromIndex = contactIdToIndex.get(wire.fromId)
      const toIndex = contactIdToIndex.get(wire.toId)
      
      if (fromIndex !== undefined && toIndex !== undefined) {
        wires.push({
          fromIndex,
          toIndex,
          type: wire.type
        })
      }
    }
    
    // Recursively convert subgroups
    const subgroupTemplates: GadgetTemplate[] = []
    for (const subgroup of this.subgroups.values()) {
      subgroupTemplates.push(subgroup.toTemplate())
    }
    
    return {
      name: this.name,
      contacts,
      wires,
      subgroupTemplates,
      boundaryIndices
    }
  }
  
  static fromTemplate(template: GadgetTemplate, parent?: ContactGroup): ContactGroup {
    const group = new ContactGroup(generateId(), template.name, parent)
    
    // Create contacts and build index to ID mapping
    const indexToContactId = new Map<number, ContactId>()
    template.contacts.forEach((contactTemplate, index) => {
      const contact = new Contact(
        generateId(),
        { ...contactTemplate.position },
        group
      )
      contact.isBoundary = contactTemplate.isBoundary
      contact.boundaryDirection = contactTemplate.boundaryDirection
      contact.name = contactTemplate.name
      contact.blendMode = contactTemplate.blendMode
      
      group.contacts.set(contact.id, contact)
      indexToContactId.set(index, contact.id)
      
      if (contactTemplate.isBoundary) {
        group.boundaryContacts.add(contact.id)
      }
    })
    
    // Create wires using the mapping
    template.wires.forEach(wireTemplate => {
      const fromId = indexToContactId.get(wireTemplate.fromIndex)
      const toId = indexToContactId.get(wireTemplate.toIndex)
      
      if (fromId && toId) {
        group.connect(fromId, toId, wireTemplate.type)
      }
    })
    
    // Recursively create subgroups
    template.subgroupTemplates.forEach(subTemplate => {
      const subgroup = ContactGroup.fromTemplate(subTemplate, group)
      group.subgroups.set(subgroup.id, subgroup)
    })
    
    return group
  }
}