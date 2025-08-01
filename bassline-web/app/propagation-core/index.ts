/**
 * Propagation Core Library
 * A headless propagation network implementation
 */

// Models
export { Contact, BoundaryContact } from './models/Contact';
export { ContactGroup } from './models/ContactGroup';
export { Wire } from './models/Wire';

// Blend Modes
export { 
  AcceptLastValue,
  KeepFirstValue
} from './models/BlendModes';

// Scheduler
export { 
  ImmediateScheduler,
  QueuedScheduler,
  type Scheduler
} from './models/Scheduler';

// Types
export type {
  UUID,
  Position,
  Content,
  BlendMode,
  PropagationEvent,
  ContentChangedEvent,
  WireAddedEvent,
  WireRemovedEvent
} from './models/types';