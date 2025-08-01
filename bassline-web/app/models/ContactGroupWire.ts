import type { ContactGroupWire, UUID, Contact } from './types';
import { EventEmitter } from '../utils/EventEmitter';

export class ContactGroupWireImpl implements ContactGroupWire {
  id: UUID;
  from: UUID;
  to: UUID;
  groupId: UUID;
  
  private eventEmitter: EventEmitter;

  constructor(
    id: UUID,
    from: UUID,
    to: UUID,
    groupId: UUID,
    eventEmitter: EventEmitter
  ) {
    this.id = id;
    this.from = from;
    this.to = to;
    this.groupId = groupId;
    this.eventEmitter = eventEmitter;
  }

  pulse(fromContact: Contact, toContact: Contact): void {
    if (!fromContact.content) {
      return;
    }

    try {
      toContact.setContent(fromContact.content.value);
      
      this.eventEmitter.emit('WirePulsed', {
        type: 'WirePulsed',
        source: this,
        timestamp: Date.now(),
        from: this.from,
        to: this.to,
        content: fromContact.content
      });
    } catch (error) {
      console.error(`Error propagating content through wire ${this.id}:`, error);
      
      this.eventEmitter.emit('WirePropagationError', {
        type: 'WirePropagationError',
        source: this,
        timestamp: Date.now(),
        error
      });
    }
  }

  isInterGroup(fromGroup: UUID | null, toGroup: UUID | null): boolean {
    return fromGroup !== toGroup;
  }

  isParentChildWire(fromGroup: UUID | null, toGroup: UUID | null, parentGroups: Map<UUID, UUID | null>): boolean {
    if (!fromGroup || !toGroup) return false;
    
    const fromParent = parentGroups.get(fromGroup);
    const toParent = parentGroups.get(toGroup);
    
    return fromParent === toGroup || toParent === fromGroup;
  }
}