import type { UUID, Position } from './types';
import { Contact, BoundaryContact } from './Contact';
import { Wire } from './Wire';

/**
 * A ContactGroup owns contacts and wires
 * Following the Smalltalk pattern - groups manage all connections
 */
export class ContactGroup {
  readonly id: UUID;
  name: string;
  position: Position;
  
  // Owned collections
  readonly contacts: Map<UUID, Contact> = new Map();
  readonly wires: Map<UUID, Wire> = new Map();
  readonly subgroups: Map<UUID, ContactGroup> = new Map();
  
  // Parent reference
  parentId: UUID | null = null;

  constructor(id: UUID, name: string, position: Position = { x: 0, y: 0 }) {
    this.id = id;
    this.name = name;
    this.position = position;
  }

  // Contact management
  addContact(contact: Contact): void {
    contact.groupId = this.id;
    contact.setGroup(this);
    this.contacts.set(contact.id, contact);
  }

  removeContact(contactId: UUID): void {
    // Remove all connected wires first
    const wiresToRemove: UUID[] = [];
    this.wires.forEach((wire, wireId) => {
      if (wire.from === contactId || wire.to === contactId) {
        wiresToRemove.push(wireId);
      }
    });
    wiresToRemove.forEach(id => this.removeWire(id));
    
    // Remove the contact
    this.contacts.delete(contactId);
  }

  // Wire management
  addWire(wire: Wire): void {
    // Validate that we can connect these contacts
    const fromContact = this.findContact(wire.from);
    const toContact = this.findContact(wire.to);
    
    if (!fromContact || !toContact) {
      throw new Error(`Cannot create wire: contacts not found`);
    }
    
    // If either contact is a boundary in a subgroup, set parent group reference
    if (fromContact.isBoundary() && fromContact.groupId !== this.id) {
      (fromContact as BoundaryContact).setParentGroup(this);
    }
    if (toContact.isBoundary() && toContact.groupId !== this.id) {
      (toContact as BoundaryContact).setParentGroup(this);
    }
    
    this.wires.set(wire.id, wire);
  }

  removeWire(wireId: UUID): void {
    this.wires.delete(wireId);
  }

  // Query methods - these replace the connection tracking on contacts
  getOutgoingWires(contactId: UUID): Wire[] {
    return Array.from(this.wires.values()).filter(w => w.from === contactId);
  }

  getIncomingWires(contactId: UUID): Wire[] {
    return Array.from(this.wires.values()).filter(w => w.to === contactId);
  }

  getOutgoingContacts(contactId: UUID): Contact[] {
    return this.getOutgoingWires(contactId)
      .map(wire => this.findContact(wire.to))
      .filter(c => c !== null) as Contact[];
  }

  getIncomingContacts(contactId: UUID): Contact[] {
    return this.getIncomingWires(contactId)
      .map(wire => this.findContact(wire.from))
      .filter(c => c !== null) as Contact[];
  }

  // Find a contact in this group or its subgroups (if boundary)
  findContact(contactId: UUID): Contact | null {
    // Check this group first
    const contact = this.contacts.get(contactId);
    if (contact) return contact;
    
    // Check subgroups for boundary contacts
    for (const subgroup of this.subgroups.values()) {
      const subContact = subgroup.contacts.get(contactId);
      if (subContact && subContact.isBoundary()) {
        return subContact;
      }
    }
    
    return null;
  }

  // Subgroup management
  addSubgroup(subgroup: ContactGroup): void {
    subgroup.parentId = this.id;
    this.subgroups.set(subgroup.id, subgroup);
  }

  removeSubgroup(subgroupId: UUID): void {
    const subgroup = this.subgroups.get(subgroupId);
    if (subgroup) {
      subgroup.parentId = null;
      this.subgroups.delete(subgroupId);
    }
  }

  // Check if this is an atomic group (primitive gadget)
  isAtomic(): boolean {
    return false; // Override in subclasses
  }
}