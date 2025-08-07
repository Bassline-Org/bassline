/**
 * @bassline/core - Core propagation network engine
 */

// Types
export * from './types'

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