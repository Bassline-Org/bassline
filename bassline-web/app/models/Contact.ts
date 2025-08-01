import type { Contact, ContactContent, BlendMode, UUID, Position } from './types';
import { DEFAULT_BLEND_MODE } from './blendModes';
import { EventEmitter } from '../utils/EventEmitter';

export class ContactImpl implements Contact {
  id: UUID;
  content: ContactContent | null = null;
  blendMode: BlendMode;
  position: Position;
  groupId: UUID | null = null;
  
  private eventEmitter: EventEmitter;

  constructor(
    id: UUID,
    position: Position = { x: 0, y: 0 },
    blendMode: BlendMode = DEFAULT_BLEND_MODE,
    eventEmitter: EventEmitter
  ) {
    this.id = id;
    this.position = position;
    this.blendMode = blendMode;
    this.eventEmitter = eventEmitter;
  }

  setContent(value: any): void {
    const timestamp = Date.now();
    const newContent = { value, timestamp };

    if (this.content === null) {
      this.content = newContent;
    } else {
      try {
        const blendedValue = this.blendMode.blend(this.content.value, value);
        this.content = { value: blendedValue, timestamp };
      } catch (error) {
        console.error(`Blend error in contact ${this.id}:`, error);
        throw error;
      }
    }

    this.eventEmitter.emit('ContactContentChanged', {
      type: 'ContactContentChanged',
      source: this,
      timestamp,
      content: this.content
    });
  }


  isBoundary(): boolean {
    return false;
  }
}