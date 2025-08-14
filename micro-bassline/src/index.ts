/**
 * Micro-Bassline: Stream-based Propagation Networks
 * 
 * A functional implementation of propagation networks with:
 * - Stream-based architecture for natural data flow
 * - Async support for real-world operations
 * - Meta-Group Protocol (MGP) for hierarchical networks
 * - Computed boundaries instead of manual state
 */

// Core types
export * from './types'

// Stream infrastructure
export { 
  stream, 
  Stream, 
  merge, 
  guards 
} from './micro-stream'

// Contacts and Groups
export { 
  contact, 
  Contact, 
  group, 
  Group, 
  gadget, 
  GadgetConfig 
} from './stream-contact'

// Runtime
export { 
  runtime, 
  Runtime 
} from './stream-runtime'

// Actions
export {
  setValue,
  createContact,
  deleteContact,
  createWire,
  deleteWire,
  createGroup,
  deleteGroup,
  updateProperties,
  fromArray,
  applyAll,
  // Action interface is already exported from types
} from './stream-actions'

// Primitive gadgets
export {
  mathPrimitives,
  stringPrimitives,
  logicPrimitives,
  controlPrimitives,
  arrayPrimitives,
  defaultPrimitives,
  getStreamPrimitives
} from './stream-primitives'