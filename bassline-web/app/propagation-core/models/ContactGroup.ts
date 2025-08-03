import type { ContactId, WireId, GroupId, Position, BlendMode } from '../types'
import { Contradiction } from '../types'
import { Contact } from './Contact'
import { Wire } from './Wire'
import type { GadgetTemplate, ContactTemplate, WireTemplate } from '../types/template'
import { serializeValue, deserializeValue } from '../utils/value-serialization'

const generateId = (): string => crypto.randomUUID()

export class ContactGroup {
  contacts = new Map<ContactId, Contact>()
  wires = new Map<WireId, Wire>()
  boundaryContacts = new Set<ContactId>()
  subgroups = new Map<GroupId, ContactGroup>()
  position: Position = { x: 0, y: 0 }
  isPrimitive: boolean = false
  
  constructor(
    public readonly id: GroupId,
    public name: string,
    public parent?: ContactGroup
  ) {}
  
  // Factory methods
  addContact(position: Position, blendMode?: BlendMode): Contact {
    const contact = new Contact(generateId(), position, this, blendMode)
    this.contacts.set(contact.id, contact)
    return contact
  }
  
  addBoundaryContact(position: Position, direction: 'input' | 'output' = 'input', name?: string, blendMode?: BlendMode): Contact {
    const contact = this.addContact(position, blendMode)
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
    // Validate contacts exist before creating wire
    const fromContact = this.canConnectTo(fromId)
    const toContact = this.canConnectTo(toId)
    
    if (!fromContact || !toContact) {
      console.warn(`Cannot connect: contacts not found. From: ${fromId} (${fromContact ? 'found' : 'missing'}), To: ${toId} (${toContact ? 'found' : 'missing'})`)
      throw new Error(`Cannot connect non-existent contacts: ${!fromContact ? fromId : toId}`)
    }
    
    const wire = new Wire(generateId(), fromId, toId, type)
    this.wires.set(wire.id, wire)
    
    if (fromContact && fromContact.content !== undefined && fromContact.content !== null) {
      // Propagate from source to target
      this.deliverContent(toId, fromContact.content, fromId)
    }
    
    if (type === 'bidirectional' && toContact && toContact.content !== undefined && toContact.content !== null) {
      // For bidirectional wires, also propagate from target to source
      this.deliverContent(fromId, toContact.content, toId)
    }
    
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
  
  getIncomingConnections(contactId: ContactId): Array<{ wire: Wire; sourceId: ContactId }> {
    const connections: Array<{ wire: Wire; sourceId: ContactId }> = []
    
    for (const wire of this.wires.values()) {
      if (wire.type === 'bidirectional') {
        if (wire.toId === contactId) {
          connections.push({ wire, sourceId: wire.fromId })
        } else if (wire.fromId === contactId) {
          connections.push({ wire, sourceId: wire.toId })
        }
      } else if (wire.type === 'directed' && wire.toId === contactId) {
        connections.push({ wire, sourceId: wire.fromId })
      }
    }
    
    return connections
  }
  
  // Check if a contact has any connections (incoming or outgoing)
  hasAnyConnections(contactId: ContactId): boolean {
    // Check in this group
    for (const wire of this.wires.values()) {
      if (wire.fromId === contactId || wire.toId === contactId) {
        return true
      }
    }
    
    // If this contact is a boundary contact and we have a parent, check parent too
    const contact = this.contacts.get(contactId)
    if (contact?.isBoundary && this.parent) {
      return this.parent.hasAnyConnections(contactId)
    }
    
    return false
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
    // First check if it's a local contact
    const localContact = this.contacts.get(contactId)
    if (localContact) {
      localContact.setContent(content, sourceId)
      return
    }
    
    // Then check if it's a boundary contact in a subgroup
    for (const subgroup of this.subgroups.values()) {
      if (subgroup.boundaryContacts.has(contactId)) {
        // Deliver to the subgroup instead
        subgroup.deliverContent(contactId, content, sourceId)
        return
      }
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
    const wire = this.wires.get(wireId)
    if (!wire) {
      // Wire not in this group, try subgroups
      for (const subgroup of this.subgroups.values()) {
        if (subgroup.removeWire(wireId)) {
          return true
        }
      }
      return false
    }
    
    // Remove the wire
    this.wires.delete(wireId)
    
    // Check both endpoints of the wire for remaining connections
    const contactsToCheck = [wire.fromId, wire.toId]
    
    for (const contactId of contactsToCheck) {
      // Check if this is a boundary contact in a subgroup
      let contact: Contact | undefined = this.contacts.get(contactId)
      let checkGroup: ContactGroup = this
      
      // If not found in this group, check if it's a boundary contact in a subgroup
      if (!contact) {
        for (const subgroup of this.subgroups.values()) {
          if (subgroup.boundaryContacts.has(contactId)) {
            contact = subgroup.contacts.get(contactId)
            checkGroup = subgroup
            break
          }
        }
      }
      
      // If the contact has no more connections, clear its content
      if (contact && !checkGroup.hasAnyConnections(contactId)) {
        contact['_content'] = undefined
        
        // If it's a boundary contact in a primitive gadget, trigger recomputation
        if (contact.isBoundary && contact.boundaryDirection === 'input' && checkGroup.isPrimitive) {
          checkGroup.deliverContent(contactId, undefined, wireId)
        }
      }
    }
    
    return true
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
        blendMode: contact.blendMode,
        content: serializeValue(contact.content)
      })
      
      if (contact.isBoundary) {
        boundaryIndices.push(index)
      }
      
      index++
    }
    
    // Track which subgroup each boundary contact belongs to
    const subgroupIdToIndex = new Map<string, number>()
    const boundaryContactToSubgroup = new Map<ContactId, number>()
    
    // Map subgroups to indices and track their boundary contacts
    let subgroupIndex = 0
    for (const subgroup of this.subgroups.values()) {
      subgroupIdToIndex.set(subgroup.id, subgroupIndex)
      for (const boundaryId of subgroup.boundaryContacts) {
        boundaryContactToSubgroup.set(boundaryId, subgroupIndex)
      }
      subgroupIndex++
    }
    
    // Convert wires to templates using the ID mapping
    const wires: WireTemplate[] = []
    for (const wire of this.wires.values()) {
      let fromIndex = contactIdToIndex.get(wire.fromId)
      let toIndex = contactIdToIndex.get(wire.toId)
      
      const wireTemplate: WireTemplate = {
        fromIndex: -1,
        toIndex: -1,
        type: wire.type
      }
      
      // Handle 'from' side
      if (fromIndex !== undefined) {
        wireTemplate.fromIndex = fromIndex
      } else {
        // Check if it's a subgroup boundary contact
        const fromSubgroupIndex = boundaryContactToSubgroup.get(wire.fromId)
        if (fromSubgroupIndex !== undefined) {
          wireTemplate.fromIndex = -1
          wireTemplate.fromSubgroupIndex = fromSubgroupIndex
          // Find the boundary contact name
          const subgroups = Array.from(this.subgroups.values())
          const fromSubgroup = subgroups[fromSubgroupIndex]
          const fromContact = fromSubgroup.contacts.get(wire.fromId)
          if (fromContact?.name) {
            wireTemplate.fromBoundaryName = fromContact.name
          }
        } else {
          console.warn(`Wire references unknown contact: ${wire.fromId}`)
          continue
        }
      }
      
      // Handle 'to' side
      if (toIndex !== undefined) {
        wireTemplate.toIndex = toIndex
      } else {
        // Check if it's a subgroup boundary contact
        const toSubgroupIndex = boundaryContactToSubgroup.get(wire.toId)
        if (toSubgroupIndex !== undefined) {
          wireTemplate.toIndex = -1
          wireTemplate.toSubgroupIndex = toSubgroupIndex
          // Find the boundary contact name
          const subgroups = Array.from(this.subgroups.values())
          const toSubgroup = subgroups[toSubgroupIndex]
          const toContact = toSubgroup.contacts.get(wire.toId)
          if (toContact?.name) {
            wireTemplate.toBoundaryName = toContact.name
          }
        } else {
          console.warn(`Wire references unknown contact: ${wire.toId}`)
          continue
        }
      }
      
      wires.push(wireTemplate)
    }
    
    // Recursively convert subgroups
    const subgroupTemplates: GadgetTemplate[] = []
    for (const subgroup of this.subgroups.values()) {
      subgroupTemplates.push(subgroup.toTemplate())
    }
    
    const template: GadgetTemplate = {
      name: this.name,
      contacts,
      wires,
      subgroupTemplates,
      boundaryIndices
    }
    
    // Include primitive information if this is a primitive gadget
    if (this.isPrimitive) {
      template.isPrimitive = true
      // For primitives, the name is the primitive type
      template.primitiveType = this.name
    }
    
    return template
  }
  
  static fromTemplate(template: GadgetTemplate, parent?: ContactGroup): ContactGroup {
    // For primitive gadgets, this will be handled by a higher-level factory
    // This method only handles regular ContactGroups
    return ContactGroup.fromTemplateWithFactory(template, parent, ContactGroup.fromTemplate)
  }
  
  static fromTemplateWithFactory(
    template: GadgetTemplate, 
    parent: ContactGroup | undefined,
    subgroupFactory: (template: GadgetTemplate, parent?: ContactGroup) => ContactGroup
  ): ContactGroup {
    // Create a regular ContactGroup
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
      
      // Restore content if present
      if (contactTemplate.content !== undefined) {
        contact.setContent(deserializeValue(contactTemplate.content))
      }
      
      group.contacts.set(contact.id, contact)
      indexToContactId.set(index, contact.id)
      
      if (contactTemplate.isBoundary) {
        group.boundaryContacts.add(contact.id)
      }
    })
    
    // Recursively create subgroups first (before wires, so boundary contacts exist)
    const subgroups: ContactGroup[] = []
    template.subgroupTemplates.forEach(subTemplate => {
      const subgroup = subgroupFactory(subTemplate, group)
      group.subgroups.set(subgroup.id, subgroup)
      subgroups.push(subgroup)
    })
    
    // Create wires using the mapping (now that subgroups exist)
    template.wires.forEach(wireTemplate => {
      let fromId: ContactId | undefined
      let toId: ContactId | undefined
      
      // Handle 'from' side
      if (wireTemplate.fromIndex >= 0) {
        fromId = indexToContactId.get(wireTemplate.fromIndex)
      } else if (wireTemplate.fromSubgroupIndex !== undefined && wireTemplate.fromBoundaryName) {
        // Find the boundary contact in the specified subgroup
        const fromSubgroup = subgroups[wireTemplate.fromSubgroupIndex]
        if (fromSubgroup) {
          // Find boundary contact by name
          for (const contact of fromSubgroup.contacts.values()) {
            if (contact.isBoundary && contact.name === wireTemplate.fromBoundaryName) {
              fromId = contact.id
              break
            }
          }
        }
      }
      
      // Handle 'to' side
      if (wireTemplate.toIndex >= 0) {
        toId = indexToContactId.get(wireTemplate.toIndex)
      } else if (wireTemplate.toSubgroupIndex !== undefined && wireTemplate.toBoundaryName) {
        // Find the boundary contact in the specified subgroup
        const toSubgroup = subgroups[wireTemplate.toSubgroupIndex]
        if (toSubgroup) {
          // Find boundary contact by name
          for (const contact of toSubgroup.contacts.values()) {
            if (contact.isBoundary && contact.name === wireTemplate.toBoundaryName) {
              toId = contact.id
              break
            }
          }
        }
      }
      
      if (fromId && toId) {
        try {
          group.connect(fromId, toId, wireTemplate.type)
        } catch (error) {
          console.error(`Failed to connect wire in template instantiation: ${error}`)
          console.error(`Wire template:`, wireTemplate)
          console.error(`Mapped IDs: fromId=${fromId}, toId=${toId}`)
        }
      } else {
        console.warn(`Missing contact IDs for wire:`, wireTemplate, `fromId=${fromId}, toId=${toId}`)
      }
    })
    
    return group
  }
}