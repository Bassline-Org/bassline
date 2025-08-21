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
  unwire,
  calculatePrimitiveOutputStrength
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
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  withTransaction,
  inTransaction
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
  createGarbageCollector,
  provideSpawnerGain
} from './spawner'

// Boot system
export {
  bootNetwork,
  loadBootScript,
  createTestBootScript,
  type BootScript,
  type Network
} from './boot'

// Stream interfaces
export {
  EventEmitter,
  createReader,
  createWriter,
  createBiStream,
  createBufferedReader,
  type Reader,
  type Writer,
  type BiStream,
  type BufferedReader
} from './streams'

// React hooks
export {
  NetworkProvider,
  useGadget,
  useContact,
  useContactValue,
  useContactWriter,
  useContactBinding,
  useBiStream,
  useBufferedSignals,
  useAutoWire,
  useManagedStream,
  useTransaction,
  useDebouncedTransaction
} from './react-streams.tsx'

// Audio gadgets
export {
  createAudioOutput,
  createOscillator,
  createEnvelope,
  createMixer,
  resumeAudioContext
} from './audio-streams'