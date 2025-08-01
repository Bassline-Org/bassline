import type { UUID, Position, Content, BlendMode } from './types';
import type { ContactGroup } from './ContactGroup';
import type { Scheduler } from './Scheduler';
import { ImmediateScheduler } from './Scheduler';

export class Contact {
  readonly id: UUID;
  position: Position;
  content: Content | null = null;
  readonly blendMode: BlendMode;
  
  // The group this contact belongs to
  groupId: UUID | null = null;
  private _group: ContactGroup | null = null;

  constructor(
    id: UUID,
    position: Position,
    blendMode: BlendMode
  ) {
    this.id = id;
    this.position = position;
    this.blendMode = blendMode;
  }

  // Set by ContactGroup when added
  setGroup(group: ContactGroup): void {
    this._group = group;
  }

  setContent(value: any, scheduler: Scheduler = new ImmediateScheduler(), visited: Set<UUID> = new Set()): void {
    // Cycle detection
    if (visited.has(this.id)) {
      // Already visited in this propagation - check if value changed
      if (this.content?.value === value) {
        return; // No change, stop propagation
      }
    }
    visited.add(this.id);

    const timestamp = Date.now();
    const newContent = { value, timestamp };

    if (this.content === null) {
      this.content = newContent;
    } else {
      const blendedValue = this.blendMode.blend(this.content.value, value);
      this.content = { value: blendedValue, timestamp };
    }

    // Propagate to outgoing contacts
    if (this._group && this.content) {
      const outgoing = this._group.getOutgoingContacts(this.id);
      const propagatedValue = this.content.value;
      outgoing.forEach(contact => {
        scheduler.schedule(() => {
          contact.setContent(propagatedValue, scheduler, visited);
        });
      });
    }
  }

  isBoundary(): boolean {
    return false;
  }
}

export class BoundaryContact extends Contact {
  private parentGroup: ContactGroup | null = null;

  setParentGroup(group: ContactGroup): void {
    this.parentGroup = group;
  }

  setContent(value: any, scheduler: Scheduler = new ImmediateScheduler(), visited: Set<UUID> = new Set()): void {
    // Call parent implementation
    super.setContent(value, scheduler, visited);
    
    // Also propagate in parent group if we have one
    if (this.parentGroup && this.groupId !== this.parentGroup.id && this.content) {
      const outgoingInParent = this.parentGroup.getOutgoingContacts(this.id);
      const propagatedValue = this.content.value;
      outgoingInParent.forEach(contact => {
        scheduler.schedule(() => {
          contact.setContent(propagatedValue, scheduler, visited);
        });
      });
    }
  }

  isBoundary(): boolean {
    return true;
  }
}