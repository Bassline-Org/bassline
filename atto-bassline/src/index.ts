/**
 * Atto-Bassline: Ultra-minimal strength-based propagation network
 * Public API
 */

// Core types
export type {
  Signal,
  Contact,
  Gadget,
  Receipt,
  Value
} from './types'

export {
  createSignal,
  createContact,
  createGadget,
  wire,
  unwire
} from './types'

// Propagation engine
export {
  propagate,
  setContacts,
  findReachable,
  cleanDeadRefs,
  HYSTERESIS
} from './propagation'

// Special gadgets
export {
  createTransistor,
  createModulator,
  createPrimitiveGadget
} from './gadgets'

// Primitive operations
export {
  createAdder,
  createMultiplier,
  createSubtractor,
  createDivider,
  createConcatenator,
  createAnd,
  createOr,
  createNot,
  createEquals,
  createGreaterThan,
  createLessThan
} from './primitives'

// Receipt tracking
export {
  createReceipt,
  getAllReceipts,
  getReceiptsForGadget,
  getReceiptsInWindow,
  getTotalAmplification,
  clearReceipts
} from './receipts'