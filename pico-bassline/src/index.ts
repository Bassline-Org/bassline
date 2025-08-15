/**
 * Pico-Bassline
 * Ultra-minimal propagation network runtime
 */

// Core exports
export { Contact, Group, WireMode } from './core'

// Type exports
export type {
  Value,
  Properties,
  AccessLevel,
  ContactAccess,
  ComputeFunction,
  PrimitiveProps,
  GroupProps,
  AnyProps,
  StructureData,
  DynamicsData
} from './types'

// Combinator exports
export { loop, sequence, parallel, forkJoin } from './combinators'

// Primitive exports
export { primitives, createPrimitive } from './primitives'

// Example exports
export {
  createAdder,
  createArithmeticChain,
  createMaxAccumulator,
  createParallelOperations,
  createDynamicSum,
  createTemperatureConverter,
  createSelfModifying,
  createForkJoinExample
} from './examples'