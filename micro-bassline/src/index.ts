/**
 * Micro-Bassline: The Unified Propagation Network Model
 * 
 * A clean implementation of propagation networks with:
 * - Unified stream/value semantics via blend modes
 * - Meta-propagation through BasslineGadget
 * - Schedulers as circuits, not machinery
 * - Properties for universal configuration
 */

// Core types
export {
  // Structure
  Bassline,
  ReifiedContact,
  ReifiedWire,
  ReifiedGroup,
  ContactId,
  WireId,
  GroupId,
  Properties,
  
  // Behavior
  BlendMode,
  PropagationEvent,
  Action,
  ActionSet,
  
  // Gadgets
  PrimitiveGadget,
  RuntimeContext,
  
  // Mergeable types
  Grow,
  Shrink,
  Mergeable,
  
  // Errors
  Contradiction,
  
  // Helper functions
  isMergeable,
  mergeValues,
  valuesEqual
} from './types'

// Runtime engine
export {
  Runtime,
  GetBasslineOptions
} from './runtime'

// Primitive gadgets
export {
  // Math
  add,
  multiply,
  subtract,
  divide,
  
  // Logic
  and,
  or,
  not,
  gate,
  
  // String
  concat,
  split,
  
  // Stream processing
  filterEvents,
  eventsToActions,
  
  // Comparison
  equals,
  greaterThan,
  lessThan,
  
  // Registry
  getPrimitives
} from './primitives'

// Meta-propagation gadget
export {
  createBasslineGadget,
  createGlobalBasslineGadget
} from './bassline-gadget'


// Convenience type aliases for common patterns
import { ReifiedContact, ReifiedWire, ReifiedGroup } from './types'
export type Contact = ReifiedContact
export type Wire = ReifiedWire
export type Group = ReifiedGroup