import type { UUID } from './types';

/**
 * A wire represents a connection between two contacts
 * It's owned by a ContactGroup and is just data - no behavior
 */
export class Wire {
  readonly id: UUID;
  readonly from: UUID;  // Source contact ID
  readonly to: UUID;    // Target contact ID
  readonly groupId: UUID;  // The group that owns this wire

  constructor(id: UUID, from: UUID, to: UUID, groupId: UUID) {
    this.id = id;
    this.from = from;
    this.to = to;
    this.groupId = groupId;
  }
}