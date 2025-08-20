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
  signal,  // Convenience function with decimal strength
  createContact,
  createGadget,
  wire,
  unwire
} from './types'

// Strength utilities
export {
  STRENGTH_BASE,
  MAX_STRENGTH,
  KILL_SIGNAL,
  HYSTERESIS_UNITS,
  toUnits,
  fromUnits,
  formatStrength,
  adjustStrength,
  STRENGTH_ZERO,
  STRENGTH_QUARTER,
  STRENGTH_HALF,
  STRENGTH_FULL,
  STRENGTH_DOUBLE
} from './strength'

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
  createGainMinter,
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

// Dynamic gadgets and spawners
export {
  createDynamicGadget,
  interpretTemplate,
  type DynamicGadgetSpec,
  type BehaviorSpec,
  type ComputeSpec,
  type TemplateSignal,
  type InstanceSignal
} from './dynamic'

export {
  createSpawner,
  createConditionalSpawner,
  createEvolver,
  createIterator,
  createGarbageCollector
} from './spawner'