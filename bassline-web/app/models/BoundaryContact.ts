import type { BoundaryContact, UUID, Position, BlendMode } from './types';
import { ContactImpl } from './Contact';
import { DEFAULT_BLEND_MODE } from './blendModes';
import { EventEmitter } from '../utils/EventEmitter';

export class BoundaryContactImpl extends ContactImpl implements BoundaryContact {
  pairedContactId: UUID | null = null;

  constructor(
    id: UUID,
    position: Position = { x: 0, y: 0 },
    blendMode: BlendMode = DEFAULT_BLEND_MODE,
    eventEmitter: EventEmitter
  ) {
    super(id, position, blendMode, eventEmitter);
  }

  setPairedContact(contactId: UUID | null): void {
    this.pairedContactId = contactId;
  }

  override isBoundary(): boolean {
    return true;
  }
}