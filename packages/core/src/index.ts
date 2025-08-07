/**
 * @bassline/core - Core propagation network engine
 */

// Types
export * from './types'

// Re-export common utilities directly
export { brand } from './types'

// Utility functions
export * from './utils'

// Fluent interfaces
export * from './fluent'

// Propagation engine
export * from './propagation'

// Schedulers
export { createImmediateScheduler } from './scheduler/immediate'
export { 
  createBatchScheduler,
  createAnimationFrameScheduler,
  createPriorityScheduler,
  type BatchSchedulerOptions 
} from './scheduler/batch'

// Primitives
export * from './primitives/index'
export * from './primitives/math'
export * from './primitives/string'
export * from './primitives/logic'
export * from './primitives/control'
export * from './primitives/array'

// Storage interface
export * from './storage/interface'

// Serialization system
export * from './serialization'
export { serialize, deserialize } from './serialization'