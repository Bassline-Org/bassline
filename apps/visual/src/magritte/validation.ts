/**
 * Validation utilities for Magritte bound descriptions
 *
 * Uses the bound type system for clean type-safe validation.
 */

import type { ValidationResult } from './schema'
import type { AnyBound, BoundContainer, BoundString, BoundNumber, BoundToOne, BoundToMany } from './bound'

export type ValidationMap = Map<AnyBound, ValidationResult>

/**
 * Check if a value is "undefined" according to schema semantics.
 */
export function isUndefinedValue(value: unknown, undefinedValue?: unknown): boolean {
  if (value === null || value === undefined) return true
  if (undefinedValue !== undefined && value === undefinedValue) return true
  if (typeof value === 'string' && value === '') return true
  return false
}

/**
 * Validate required constraint
 */
function validateRequired(required: boolean, value: unknown, undefinedValue?: unknown): ValidationResult | null {
  if (required && isUndefinedValue(value, undefinedValue)) {
    return {
      valid: false,
      errors: [{ message: 'Required', severity: 'error' }],
    }
  }
  return null
}

/**
 * Validate string-specific constraints
 */
function validateStringConstraints(bound: BoundString, value: string): ValidationResult {
  if (bound.minLength !== undefined && value.length < bound.minLength) {
    return {
      valid: false,
      errors: [{ message: `Minimum length is ${bound.minLength}`, severity: 'warning' }],
    }
  }
  if (bound.maxLength !== undefined && value.length > bound.maxLength) {
    return {
      valid: false,
      errors: [{ message: `Maximum length is ${bound.maxLength}`, severity: 'warning' }],
      effects: bound.onTooLong === 'truncate' ? [{ type: 'truncate', data: bound.maxLength }] : undefined,
    }
  }
  if (bound.pattern && !bound.pattern.test(value)) {
    return {
      valid: false,
      errors: [{ message: 'Invalid format', severity: 'warning' }],
    }
  }
  return { valid: true, errors: [] }
}

/**
 * Validate number-specific constraints
 */
function validateNumberConstraints(bound: BoundNumber, value: number): ValidationResult {
  if (bound.min !== undefined && value < bound.min) {
    return {
      valid: false,
      errors: [{ message: `Minimum is ${bound.min}`, severity: 'warning' }],
      effects: bound.onOutOfRange === 'clamp' ? [{ type: 'clamp', data: { min: bound.min } }] : undefined,
    }
  }
  if (bound.max !== undefined && value > bound.max) {
    return {
      valid: false,
      errors: [{ message: `Maximum is ${bound.max}`, severity: 'warning' }],
      effects: bound.onOutOfRange === 'clamp' ? [{ type: 'clamp', data: { max: bound.max } }] : undefined,
    }
  }
  if (bound.integer && !Number.isInteger(value)) {
    return {
      valid: false,
      errors: [{ message: 'Must be an integer', severity: 'warning' }],
    }
  }
  return { valid: true, errors: [] }
}

/**
 * Validate toOne-specific constraints
 */
function validateToOneConstraints(bound: BoundToOne, value: unknown): ValidationResult {
  if (!bound.nullable && value === null) {
    return {
      valid: false,
      errors: [{ message: 'Cannot be empty', severity: 'error' }],
    }
  }
  return { valid: true, errors: [] }
}

/**
 * Validate toMany-specific constraints
 */
function validateToManyConstraints(bound: BoundToMany, items: unknown[]): ValidationResult {
  if (bound.minItems !== undefined && items.length < bound.minItems) {
    return {
      valid: false,
      errors: [{ message: `Minimum ${bound.minItems} items required`, severity: 'warning' }],
    }
  }
  if (bound.maxItems !== undefined && items.length > bound.maxItems) {
    return {
      valid: false,
      errors: [{ message: `Maximum ${bound.maxItems} items allowed`, severity: 'warning' }],
    }
  }
  return { valid: true, errors: [] }
}

/**
 * Validate a single bound field and all its children
 */
function validateSingleBound(bound: AnyBound, results: ValidationMap): void {
  switch (bound.kind) {
    case 'string': {
      const value = bound.read()
      const requiredResult = validateRequired(bound.required, value, bound.undefinedValue)
      if (requiredResult) {
        results.set(bound, requiredResult)
        return
      }
      if (isUndefinedValue(value, bound.undefinedValue)) {
        results.set(bound, { valid: true, errors: [] })
        return
      }
      if (bound.validate) {
        const customResult = bound.validate(value)
        if (!customResult.valid) {
          results.set(bound, customResult)
          return
        }
      }
      results.set(bound, validateStringConstraints(bound, value))
      break
    }

    case 'number': {
      const value = bound.read()
      const requiredResult = validateRequired(bound.required, value, bound.undefinedValue)
      if (requiredResult) {
        results.set(bound, requiredResult)
        return
      }
      if (isUndefinedValue(value, bound.undefinedValue)) {
        results.set(bound, { valid: true, errors: [] })
        return
      }
      if (bound.validate) {
        const customResult = bound.validate(value)
        if (!customResult.valid) {
          results.set(bound, customResult)
          return
        }
      }
      results.set(bound, validateNumberConstraints(bound, value))
      break
    }

    case 'boolean': {
      const value = bound.read()
      const requiredResult = validateRequired(bound.required, value)
      if (requiredResult) {
        results.set(bound, requiredResult)
        return
      }
      if (bound.validate) {
        const customResult = bound.validate(value)
        if (!customResult.valid) {
          results.set(bound, customResult)
          return
        }
      }
      results.set(bound, { valid: true, errors: [] })
      break
    }

    case 'container': {
      // Validate children
      for (const child of Object.values(bound.children)) {
        validateSingleBound(child, results)
      }
      break
    }

    case 'toOne': {
      const value = bound.read()
      const requiredResult = validateRequired(bound.required, value)
      if (requiredResult) {
        results.set(bound, requiredResult)
        return
      }
      if (bound.validate) {
        const customResult = bound.validate(value)
        if (!customResult.valid) {
          results.set(bound, customResult)
          return
        }
      }
      results.set(bound, validateToOneConstraints(bound, value))
      // Note: We don't recurse into boundChild() here - shallow validation only
      // The component will validate nested forms separately
      break
    }

    case 'toMany': {
      const items = bound.read()
      const requiredResult = validateRequired(bound.required, items)
      if (requiredResult) {
        results.set(bound, requiredResult)
        return
      }
      if (bound.validate) {
        const customResult = bound.validate(items)
        if (!customResult.valid) {
          results.set(bound, customResult)
          return
        }
      }
      results.set(bound, validateToManyConstraints(bound, items ?? []))
      // Note: We don't recurse into boundItems() here - shallow validation only
      break
    }
  }
}

/**
 * Validate all bound descriptions in a container (shallow - direct children only)
 */
export function validateBound(bound: BoundContainer): ValidationMap {
  const results = new Map<AnyBound, ValidationResult>()
  validateSingleBound(bound, results)
  return results
}

/**
 * Validate a bound container deeply (including nested relations)
 */
export function validateBoundDeep(bound: BoundContainer): ValidationMap {
  const results = new Map<AnyBound, ValidationResult>()
  validateBoundRecursive(bound, results)
  return results
}

function validateBoundRecursive(bound: AnyBound, results: ValidationMap): void {
  // First validate this bound
  validateSingleBound(bound, results)

  // Then recurse into relations
  switch (bound.kind) {
    case 'container':
      for (const child of Object.values(bound.children)) {
        validateBoundRecursive(child, results)
      }
      break

    case 'toOne': {
      const child = bound.boundChild()
      if (child) {
        validateBoundRecursive(child, results)
      }
      break
    }

    case 'toMany': {
      for (const item of bound.boundItems()) {
        validateBoundRecursive(item, results)
      }
      break
    }
  }
}

/**
 * Check if validation results contain any errors (not just warnings)
 */
export function hasValidationErrors(validation: ValidationMap): boolean {
  for (const result of validation.values()) {
    if (result.errors.some(e => e.severity === 'error')) {
      return true
    }
  }
  return false
}

/**
 * Check if validation results contain any warnings
 */
export function hasValidationWarnings(validation: ValidationMap): boolean {
  for (const result of validation.values()) {
    if (result.errors.some(e => e.severity === 'warning')) {
      return true
    }
  }
  return false
}

/**
 * Get all validation errors from a validation map
 */
export function getValidationErrors(validation: ValidationMap): Array<{ bound: AnyBound; result: ValidationResult }> {
  const errors: Array<{ bound: AnyBound; result: ValidationResult }> = []
  for (const [bound, result] of validation) {
    if (!result.valid) {
      errors.push({ bound, result })
    }
  }
  return errors
}

/**
 * Check if a specific bound has validation errors
 */
export function hasBoundErrors(validation: ValidationMap, bound: AnyBound): boolean {
  const result = validation.get(bound)
  return result ? !result.valid : false
}

/**
 * Get validation result for a specific bound
 */
export function getBoundValidation(validation: ValidationMap, bound: AnyBound): ValidationResult {
  return validation.get(bound) ?? { valid: true, errors: [] }
}
