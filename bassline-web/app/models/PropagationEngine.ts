import type { Contact, ContactGroup, ContactGroupWire, UUID } from './types';
import { EventEmitter } from '../utils/EventEmitter';
import { ContactGroupWireImpl } from './ContactGroupWire';

export interface PropagationContext {
  visitedContacts: Set<UUID>;
  propagationPath: UUID[];
  cycleDetected: boolean;
}

export class PropagationEngine {
  private eventEmitter: EventEmitter;
  private propagationQueue: Array<{ wireId: UUID; groupId: UUID }> = [];
  private isPropagating = false;

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;

    // Listen for content changes to trigger propagation
    this.eventEmitter.on('ContactContentChanged', (event) => {
      this.handleContactContentChanged(event);
    });
  }

  private handleContactContentChanged(event: any): void {
    const contact = event.source as Contact;
    
    // Find all outgoing wires from this contact
    const wiresToPropagate: Array<{ wireId: UUID; groupId: UUID }> = [];
    
    // This would typically be done by querying the ContactGroup
    // For now, we'll emit an event to request propagation
    this.eventEmitter.emit('RequestPropagation', {
      type: 'RequestPropagation',
      contactId: contact.id,
      timestamp: Date.now()
    });
  }

  propagateFromContact(contact: Contact, group: ContactGroup): void {
    if (this.isPropagating) {
      // Queue the propagation to avoid infinite loops
      return;
    }

    this.isPropagating = true;
    const context: PropagationContext = {
      visitedContacts: new Set([contact.id]),
      propagationPath: [contact.id],
      cycleDetected: false
    };

    try {
      this.propagateFromContactRecursive(contact, group, context);
    } finally {
      this.isPropagating = false;
      
      if (context.cycleDetected) {
        this.eventEmitter.emit('PropagationCycleDetected', {
          type: 'PropagationCycleDetected',
          path: context.propagationPath,
          timestamp: Date.now()
        });
      }
    }
  }

  private propagateFromContactRecursive(
    contact: Contact,
    group: ContactGroup,
    context: PropagationContext
  ): void {
    // Find all wires originating from this contact
    const outgoingWires: ContactGroupWire[] = [];
    
    group.wires.forEach(wire => {
      if (wire.from === contact.id) {
        outgoingWires.push(wire);
      }
    });

    // Propagate through each wire
    for (const wire of outgoingWires) {
      const toContact = group.contacts.get(wire.to);
      if (!toContact) continue;

      // Check for cycles
      if (context.visitedContacts.has(wire.to)) {
        context.cycleDetected = true;
        // In a constraint propagation network, cycles are allowed
        // We continue propagation only if the value would change
        const currentValue = toContact.content?.value;
        const incomingValue = contact.content?.value;
        
        if (currentValue === incomingValue) {
          continue; // No change, stop propagation on this path
        }
      }

      // Propagate the value
      try {
        if (wire instanceof ContactGroupWireImpl) {
          wire.pulse(contact, toContact);
        }

        // Continue propagation if this is a new contact
        if (!context.visitedContacts.has(wire.to)) {
          context.visitedContacts.add(wire.to);
          context.propagationPath.push(wire.to);
          
          this.propagateFromContactRecursive(toContact, group, context);
          
          context.propagationPath.pop();
        }
      } catch (error) {
        this.eventEmitter.emit('PropagationError', {
          type: 'PropagationError',
          wireId: wire.id,
          fromContactId: wire.from,
          toContactId: wire.to,
          error,
          timestamp: Date.now()
        });
      }
    }
  }

  propagateThroughWire(wire: ContactGroupWire, group: ContactGroup): void {
    const fromContact = group.contacts.get(wire.from);
    const toContact = group.contacts.get(wire.to);

    if (!fromContact || !toContact) {
      console.error(`Cannot propagate through wire ${wire.id}: contacts not found`);
      return;
    }

    try {
      if (wire instanceof ContactGroupWireImpl) {
        wire.pulse(fromContact, toContact);
      }

      // Continue propagation from the target contact
      this.propagateFromContact(toContact, group);
    } catch (error) {
      this.eventEmitter.emit('PropagationError', {
        type: 'PropagationError',
        wireId: wire.id,
        error,
        timestamp: Date.now()
      });
    }
  }

  // Batch propagation for multiple changes
  batchPropagate(contacts: Contact[], group: ContactGroup): void {
    const allVisited = new Set<UUID>();
    
    for (const contact of contacts) {
      if (!allVisited.has(contact.id)) {
        const context: PropagationContext = {
          visitedContacts: new Set([...allVisited, contact.id]),
          propagationPath: [contact.id],
          cycleDetected: false
        };
        
        this.propagateFromContactRecursive(contact, group, context);
        
        // Merge visited contacts
        context.visitedContacts.forEach(id => allVisited.add(id));
      }
    }
  }
}