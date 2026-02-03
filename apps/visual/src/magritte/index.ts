/**
 * Magritte Meta-Description Framework
 *
 * A framework for describing object structure with consequential validation.
 * Named after Ren Magritte's "Ceci n'est pas une pipe" - this is not a description,
 * it's a description of a description.
 */

// Core description types and factories
export {
  // Types
  type Accessor,
  type ValidationError,
  type ValidationEffect,
  type ValidationResult,
  type StringDescription,
  type NumberDescription,
  type BooleanDescription,
  type ContainerDescription,
  type ToOneDescription,
  type ToManyDescription,
  type AnyDescription,

  // Utilities
  prop,
  path,
  validResult,
  invalidResult,

  // Factory object
  describe,
} from './description'

// Condition system
export {
  // Condition type
  type Condition,

  // Combinators
  all,
  any,
  not,

  // String conditions
  minLength,
  maxLength,
  lengthBetween,
  pattern,
  nonEmpty,
  startsWith,
  endsWith,
  contains,
  isEmail,
  isUrl,
  isAlphanumeric,

  // Number conditions
  min,
  max,
  range,
  integer,
  positive,
  negative,
  nonZero,
  finite,
  multipleOf,

  // Boolean conditions
  isTrue,
  isFalse,

  // Generic conditions
  isNull,
  isUndefined,
  isNullish,
  isDefined,
  equals,
  oneOf,

  // Conversion utilities
  conditionToValidator,
  combineValidators,
  conditionalValidator,
} from './conditions'

// React hooks
export { type DescribedState, useDescribedState, useDescriptionValidation } from './hooks'

// Field components
export { DescribedField, DescribedForm } from './fields'
