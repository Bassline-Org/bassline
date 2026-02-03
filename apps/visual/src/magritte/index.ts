/**
 * Magritte Meta-Description Framework
 *
 * A framework for describing object structure with consequential validation.
 *
 * ## Architecture: Schema + Bound
 *
 * - **Schema**: Pure metadata, no generics, defines structure and constraints
 * - **Bound**: Runtime binding that connects schemas to model instances
 *
 * This design eliminates type casts in components by using discriminated union narrowing.
 */

// === Schema Layer (metadata, no generics) ===

export {
  // Schema types
  type StringSchema,
  type NumberSchema,
  type BooleanSchema,
  type ContainerSchema,
  type ToOneSchema,
  type ToManySchema,
  type AnySchema,

  // Validation types
  type ValidationError,
  type ValidationEffect,
  type ValidationResult,
  validResult,
  invalidResult,

  // Factory
  schema,
} from './schema'

// === Bound Layer (runtime binding) ===

export {
  // Bound types (concrete, no generics)
  type BoundString,
  type BoundNumber,
  type BoundBoolean,
  type BoundContainer,
  type BoundToOne,
  type BoundToMany,
  type AnyBound,

  // Binding functions
  bindContainer,
  bindField,
  createBinder,
} from './bound'

// === Validation ===

export {
  type ValidationMap,
  isUndefinedValue,
  validateBound,
  validateBoundDeep,
  hasValidationErrors,
  hasValidationWarnings,
  getValidationErrors,
  hasBoundErrors,
  getBoundValidation,
} from './validation'

// === React Hooks ===

export { type BoundState, useBoundState, useBoundValidation, useInlineEdit } from './hooks'

// === React Components ===

export {
  BoundField,
  BoundForm,
  // Legacy aliases
  DescribedField,
  DescribedForm,
} from './fields'

// === Conditions (commonly used) ===

export {
  type Condition,

  // Combinators
  all,
  any,
  not,

  // String conditions
  minLength,
  maxLength,
  pattern,
  isEmail,

  // Number conditions
  min,
  max,
  range,
  integer,

  // Validator conversion
  conditionToValidator,
  combineValidators,
  conditionalValidator,
} from './conditions'
