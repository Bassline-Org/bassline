import type { ContactGroup, Contact, ContactGroupWire, UUID, Position, RefactorAction } from './types';
import { EventEmitter } from '../utils/EventEmitter';
import { ContactImpl } from './Contact';
import { BoundaryContactImpl } from './BoundaryContact';
import { ContactGroupWireImpl } from './ContactGroupWire';

export class ContactGroupImpl implements ContactGroup {
  id: UUID;
  name: string;
  contacts: Map<UUID, Contact> = new Map();
  wires: Map<UUID, ContactGroupWire> = new Map();
  subgroups: Map<UUID, ContactGroup> = new Map();
  parentId: UUID | null = null;
  position: Position;
  
  private eventEmitter: EventEmitter;

  constructor(
    id: UUID,
    name: string,
    position: Position = { x: 0, y: 0 },
    eventEmitter: EventEmitter
  ) {
    this.id = id;
    this.name = name;
    this.position = position;
    this.eventEmitter = eventEmitter;
  }

  addContact(contact: Contact): void {
    contact.groupId = this.id;
    this.contacts.set(contact.id, contact);
    
    this.eventEmitter.emit('ContactAdded', {
      type: 'ContactAdded',
      source: this,
      timestamp: Date.now(),
      contact
    });
  }

  removeContact(contactId: UUID): void {
    const contact = this.contacts.get(contactId);
    if (!contact) return;

    // Remove all wires connected to this contact
    const wiresToRemove: UUID[] = [];
    this.wires.forEach((wire, wireId) => {
      if (wire.from === contactId || wire.to === contactId) {
        wiresToRemove.push(wireId);
      }
    });
    
    wiresToRemove.forEach(wireId => this.removeWire(wireId));
    
    this.contacts.delete(contactId);
    
    this.eventEmitter.emit('ContactRemoved', {
      type: 'ContactRemoved',
      source: this,
      timestamp: Date.now(),
      contactId
    });
  }

  addWire(wire: ContactGroupWire): void {
    // First check if contacts are in this group
    let fromContact = this.contacts.get(wire.from);
    let toContact = this.contacts.get(wire.to);
    
    // If not found, check if they are boundary contacts in subgroups
    let fromInSubgroup = false;
    let toInSubgroup = false;
    
    if (!fromContact) {
      for (const subgroup of this.subgroups.values()) {
        fromContact = subgroup.contacts.get(wire.from);
        if (fromContact && fromContact.isBoundary()) {
          fromInSubgroup = true;
          break;
        }
      }
    }
    
    if (!toContact) {
      for (const subgroup of this.subgroups.values()) {
        toContact = subgroup.contacts.get(wire.to);
        if (toContact && toContact.isBoundary()) {
          toInSubgroup = true;
          break;
        }
      }
    }
    
    if (!fromContact || !toContact) {
      throw new Error(`Cannot add wire: contacts not found in group or subgroups`);
    }
    
    // Only allow connections to/from boundary contacts if they're in subgroups
    if ((fromInSubgroup && !fromContact.isBoundary()) || 
        (toInSubgroup && !toContact.isBoundary())) {
      throw new Error(`Cannot connect to non-boundary contacts in subgroups`);
    }
    
    // No need to track connections on contacts - the group owns the wires
    
    this.wires.set(wire.id, wire);
    
    this.eventEmitter.emit('WireAdded', {
      type: 'WireAdded',
      source: this,
      timestamp: Date.now(),
      wire
    });
  }

  removeWire(wireId: UUID): void {
    const wire = this.wires.get(wireId);
    if (!wire) return;
    
    const fromContact = this.contacts.get(wire.from);
    const toContact = this.contacts.get(wire.to);
    
    // No need to update contacts - the group owns the wires
    
    this.wires.delete(wireId);
    
    this.eventEmitter.emit('WireRemoved', {
      type: 'WireRemoved',
      source: this,
      timestamp: Date.now(),
      wireId
    });
  }

  addSubgroup(subgroup: ContactGroup): void {
    subgroup.parentId = this.id;
    this.subgroups.set(subgroup.id, subgroup);
    
    this.eventEmitter.emit('SubgroupAdded', {
      type: 'SubgroupAdded',
      source: this,
      timestamp: Date.now(),
      subgroup
    });
  }

  removeSubgroup(subgroupId: UUID): void {
    const subgroup = this.subgroups.get(subgroupId);
    if (!subgroup) return;
    
    subgroup.parentId = null;
    this.subgroups.delete(subgroupId);
    
    this.eventEmitter.emit('SubgroupRemoved', {
      type: 'SubgroupRemoved',
      source: this,
      timestamp: Date.now(),
      subgroupId
    });
  }

  applyRefactorActions(actions: RefactorAction[]): void {
    const rollbackActions: (() => void)[] = [];
    
    try {
      for (const action of actions) {
        switch (action.type) {
          case 'addContact': {
            this.addContact(action.contact);
            rollbackActions.push(() => this.removeContact(action.contact.id));
            break;
          }
          
          case 'removeContact': {
            const contact = this.contacts.get(action.contactId);
            if (contact) {
              this.removeContact(action.contactId);
              rollbackActions.push(() => this.addContact(contact));
            }
            break;
          }
          
          case 'addWire': {
            this.addWire(action.wire);
            rollbackActions.push(() => this.removeWire(action.wire.id));
            break;
          }
          
          case 'removeWire': {
            const wire = this.wires.get(action.wireId);
            if (wire) {
              this.removeWire(action.wireId);
              rollbackActions.push(() => this.addWire(wire));
            }
            break;
          }
          
          case 'moveContact': {
            const contact = this.contacts.get(action.contactId);
            if (contact) {
              const oldPosition = { ...contact.position };
              contact.position = action.newPosition;
              rollbackActions.push(() => { contact.position = oldPosition; });
            }
            break;
          }
          
          case 'extractSubgroup': {
            // TODO: Implement subgroup extraction
            break;
          }
        }
      }
    } catch (error) {
      // Rollback all changes if any action fails
      rollbackActions.reverse().forEach(rollback => rollback());
      throw error;
    }
  }

  getAllContacts(): Contact[] {
    const allContacts: Contact[] = [...this.contacts.values()];
    
    this.subgroups.forEach(subgroup => {
      if (subgroup instanceof ContactGroupImpl) {
        allContacts.push(...subgroup.getAllContacts());
      }
    });
    
    return allContacts;
  }

  getAllWires(): ContactGroupWire[] {
    const allWires: ContactGroupWire[] = [...this.wires.values()];
    
    this.subgroups.forEach(subgroup => {
      if (subgroup instanceof ContactGroupImpl) {
        allWires.push(...subgroup.getAllWires());
      }
    });
    
    return allWires;
  }
  
  // Query methods following Smalltalk pattern
  getIncomingWires(contactId: UUID): ContactGroupWire[] {
    return Array.from(this.wires.values()).filter(wire => wire.to === contactId);
  }
  
  getOutgoingWires(contactId: UUID): ContactGroupWire[] {
    return Array.from(this.wires.values()).filter(wire => wire.from === contactId);
  }
  
  getIncomingContacts(contactId: UUID): Contact[] {
    return this.getIncomingWires(contactId)
      .map(wire => this.findContactById(wire.from))
      .filter(c => c !== null) as Contact[];
  }
  
  getOutgoingContacts(contactId: UUID): Contact[] {
    return this.getOutgoingWires(contactId)
      .map(wire => this.findContactById(wire.to))
      .filter(c => c !== null) as Contact[];
  }
  
  findContactById(contactId: UUID): Contact | null {
    // Check in this group
    const contact = this.contacts.get(contactId);
    if (contact) return contact;
    
    // Check in subgroups (boundary contacts)
    for (const subgroup of this.subgroups.values()) {
      const subContact = subgroup.contacts.get(contactId);
      if (subContact && subContact.isBoundary()) {
        return subContact;
      }
    }
    
    return null;
  }
  
  // Override in subclasses like PrimitiveGadget to mark as atomic
  isAtomic(): boolean {
    return false;
  }
}