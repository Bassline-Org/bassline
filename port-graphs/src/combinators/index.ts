// A library of combinators for working with terms
// Because terms are basically like token streams, we can use combinators to work with them, similar to parser combinators

// ================================
// Re-exports from modular files
// ================================

// Export types (but not when to avoid conflicts)
export type { TermMap, TermPredicate, PredicateCombinator, Pipeline, IfMap } from './types'
export type { WhenMap } from './types'

// Export predicates
export * from './predicates'

// Export combinators (but not when to avoid conflicts)
export { or, and, not, nor, pipe, compose, composeMany, id, constant } from './combinators'
export { when } from './combinators'

// ================================
// Convenience exports
// ================================

import { 
  or, and, not, nor, pipe, when, compose, composeMany,
  id, constant
} from './combinators'

import {
  isString, isNumber, isBoolean, isSymbol, isArray, isObject,
  hasTag, isTagged, hasLength, hasMinLength,
  eq, ne, gt, lt, gte, lte, inRange
} from './predicates'

// Main export object for easy access
export const P = {
  // Logical combinators
  or,
  and, 
  not,
  nor,
  
  // Transformation combinators
  pipe,
  when,
  
  // Composition helpers
  compose,
  composeMany,
  
  // Type predicates
  isString,
  isNumber,
  isBoolean,
  isSymbol,
  isArray,
  isObject,
  
  // Structural predicates
  hasTag,
  isTagged,
  hasLength,
  hasMinLength,
  
  // Comparison predicates
  eq,
  ne,
  gt,
  lt,
  gte,
  lte,
  inRange,
  
  // Utilities
  id,
  constant,
}