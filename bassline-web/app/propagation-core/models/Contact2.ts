import type { UUID, Position } from './types';
import type { ContactGroup } from './ContactGroup';
import type { Scheduler } from './Scheduler';
import { ImmediateScheduler } from './Scheduler';
import { MergeableContent, Contradiction, SimpleContent } from './MergeableContent';

/**
 * A contact in the propagation network
 * Holds content and propagates changes to connected contacts
 */
export class Contact {
  readonly id: UUID;
  position: Position;
  content: MergeableContent | null = null;
  mergeStrategy: 'last' | 'first' | 'merge' = 'merge'; // Default to lattice merge
  
  // The group this contact belongs to
  groupId: UUID | null = null;
  private _group: ContactGroup | null = null;

  constructor(
    id: UUID,
    position: Position,
    mergeStrategy: 'last' | 'first' | 'merge' = 'merge'
  ) {
    this.id = id;
    this.position = position;
    this.mergeStrategy = mergeStrategy;
  }

  // Set by ContactGroup when added
  setGroup(group: ContactGroup): void {
    this._group = group;
  }

  setContent(value: MergeableContent | any, scheduler: Scheduler = new ImmediateScheduler(), visited: Set<UUID> = new Set()): void {
    // Cycle detection
    if (visited.has(this.id)) {
      return; // Already visited
    }
    visited.add(this.id);

    // Wrap raw values in SimpleContent
    const incomingContent = (typeof value === 'object' && value !== null && 'merge' in value) 
      ? value as MergeableContent
      : new SimpleContent(value);

    // Merge with existing content based on strategy
    if (this.content === null) {
      this.content = incomingContent;
    } else {
      switch (this.mergeStrategy) {
        case 'last':
          // Always accept the incoming value
          this.content = incomingContent;
          break;
          
        case 'first':
          // Keep the existing value, ignore incoming
          // Do nothing
          break;
          
        case 'merge':
          // Use the content's merge method (lattice merge)
          const merged = this.content.merge(incomingContent);
          
          // Check for contradiction
          if (merged instanceof Contradiction) {
            console.warn(`Contradiction in contact ${this.id}: ${merged.reason}`);
            this.content = merged;
            // Could emit a contradiction event here
            return; // Don't propagate contradictions
          }
          
          this.content = merged;
          break;
      }
    }

    // Propagate to outgoing contacts
    if (this._group && this.content && !(this.content instanceof Contradiction)) {
      const outgoing = this._group.getOutgoingContacts(this.id);
      const propagatedContent = this.content;
      outgoing.forEach(contact => {
        scheduler.schedule(() => {
          contact.setContent(propagatedContent, scheduler, visited);
        });
      });
    }
  }

  // Convenience method to get the raw value
  getValue(): any {
    if (!this.content) return null;
    if (this.content instanceof Contradiction) return null;
    if ('value' in this.content) return this.content.value;
    return this.content;
  }

  hasContradiction(): boolean {
    return this.content instanceof Contradiction;
  }

  isBoundary(): boolean {
    return false;
  }
}

/**
 * A boundary contact can exist at group boundaries
 */
export class BoundaryContact extends Contact {
  private parentGroup: ContactGroup | null = null;

  setParentGroup(group: ContactGroup): void {
    this.parentGroup = group;
  }

  setContent(value: MergeableContent | any, scheduler: Scheduler = new ImmediateScheduler(), visited: Set<UUID> = new Set()): void {
    // Call parent implementation
    super.setContent(value, scheduler, visited);
    
    // Also propagate in parent group if we have one
    if (this.parentGroup && this.groupId !== this.parentGroup.id && this.content && !(this.content instanceof Contradiction)) {
      const outgoingInParent = this.parentGroup.getOutgoingContacts(this.id);
      const propagatedContent = this.content;
      outgoingInParent.forEach(contact => {
        scheduler.schedule(() => {
          contact.setContent(propagatedContent, scheduler, visited);
        });
      });
    }
  }

  isBoundary(): boolean {
    return true;
  }
}