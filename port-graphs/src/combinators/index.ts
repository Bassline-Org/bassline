// A library of combinators for working with terms
// Because terms are basically like token streams, we can use combinators to work with them, similar to parser combinators

// ================================
// Re-exports from modular files
// ================================

// Export predicates
export * from './predicates'

// Export combinators
export { or, and, not, nor, pipe, when, compose, composeMany, id, constant } from './combinators'

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
  eq, ne, gt, lt, gte, lte, inRange,
  startsWith, hasStructure, sequence
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
  
  // Structural matching combinators
  startsWith,
  hasStructure,
  sequence,
  
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