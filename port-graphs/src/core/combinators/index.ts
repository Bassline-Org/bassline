// A library of combinators for working with terms
// Because terms are basically like token streams, we can use combinators to work with them, similar to parser combinators

// ================================
// Re-exports from modular files
// ================================

// Export predicates
export * from './predicates'

// Export combinators
export { or, and, not, nor, pipe, when, compose, composeMany, id, constant, zod, zodPredicate } from './combinators'

// ================================
// Convenience exports
// ================================

import { 
  or, and, not, nor, pipe, when, compose, composeMany,
  id, constant, zod, zodPredicate
} from './combinators'

import {
  isString, isNumber, isBoolean, isSymbol, isArray, isObject,
  hasTag, isTagged, hasLength, hasMinLength,
  eq, ne, gt, lt, gte, lte, inRange,
  startsWith, hasStructure, sequence,

  hasKeys, hasKeyValue, objectStructure, hasMinKeys, hasExactKeys, objectValues,
  isNull
} from './predicates'

// Main export object for easy access
export const P = {
  // Logical combinators
  or, and, not, nor,
  // Transformation combinators
  pipe, when,
  // Composition helpers
  compose, composeMany,
  // Zod integration
  zod, zodPredicate,
  // Type predicates
  isString, isNumber, isBoolean, isSymbol, isArray, isObject, isNull,
  // Structural predicates
  hasTag, isTagged, hasLength, hasMinLength,
  // Structural matching combinators (added)
  startsWith, hasStructure, sequence,
  // Object predicates (added)
  hasKeys, hasKeyValue, objectStructure, hasMinKeys, hasExactKeys, objectValues,
  // Comparison predicates
  eq, ne, gt, lt, gte, lte, inRange,
  // Utilities
  id, constant,
}