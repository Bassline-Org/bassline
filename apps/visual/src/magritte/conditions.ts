/**
 * Condition System - Composable validation predicates
 *
 * Conditions are simple predicates that can be combined with AND/OR/NOT.
 * They are converted to validators for use with descriptions.
 */

import type { ValidationResult, ValidationError } from './schema'

export type Condition<V> = (value: V) => boolean

// === Combinators ===

export const all =
  <V>(...conds: Condition<V>[]): Condition<V> =>
  v =>
    conds.every(c => c(v))

export const any =
  <V>(...conds: Condition<V>[]): Condition<V> =>
  v =>
    conds.some(c => c(v))

export const not =
  <V>(cond: Condition<V>): Condition<V> =>
  v =>
    !cond(v)

// === String Conditions ===

export const minLength =
  (n: number): Condition<string> =>
  v =>
    v.length >= n

export const maxLength =
  (n: number): Condition<string> =>
  v =>
    v.length <= n

export const lengthBetween = (min: number, max: number): Condition<string> => all(minLength(min), maxLength(max))

export const pattern =
  (re: RegExp): Condition<string> =>
  v =>
    re.test(v)

export const nonEmpty: Condition<string> = v => v.trim().length > 0

export const startsWith =
  (prefix: string): Condition<string> =>
  v =>
    v.startsWith(prefix)

export const endsWith =
  (suffix: string): Condition<string> =>
  v =>
    v.endsWith(suffix)

export const contains =
  (substring: string): Condition<string> =>
  v =>
    v.includes(substring)

// Common patterns
export const isEmail: Condition<string> = pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)

export const isUrl: Condition<string> = pattern(/^https?:\/\/.+/)

export const isAlphanumeric: Condition<string> = pattern(/^[a-zA-Z0-9]+$/)

// === Number Conditions ===

export const min =
  (n: number): Condition<number> =>
  v =>
    v >= n

export const max =
  (n: number): Condition<number> =>
  v =>
    v <= n

export const range = (lo: number, hi: number): Condition<number> => all(min(lo), max(hi))

export const integer: Condition<number> = v => Number.isInteger(v)

export const positive: Condition<number> = min(0)

export const negative: Condition<number> = max(0)

export const nonZero: Condition<number> = v => v !== 0

export const finite: Condition<number> = v => Number.isFinite(v)

export const multipleOf =
  (n: number): Condition<number> =>
  v =>
    v % n === 0

// === Boolean Conditions ===

export const isTrue: Condition<boolean> = v => v === true

export const isFalse: Condition<boolean> = v => v === false

// === Generic Conditions ===

export const isNull: Condition<unknown> = v => v === null

export const isUndefined: Condition<unknown> = v => v === undefined

export const isNullish: Condition<unknown> = v => v === null || v === undefined

export const isDefined: Condition<unknown> = not(isNullish)

export const equals =
  <V>(expected: V): Condition<V> =>
  v =>
    v === expected

export const oneOf =
  <V>(...values: V[]): Condition<V> =>
  v =>
    values.includes(v)

// === Condition to Validator Conversion ===

/**
 * Convert a condition to a validator function
 */
export const conditionToValidator =
  <V>(cond: Condition<V>, message: string, severity: ValidationError['severity'] = 'error') =>
  (value: V): ValidationResult => ({
    valid: cond(value),
    errors: cond(value) ? [] : [{ message, severity }],
  })

/**
 * Combine multiple validators into one
 */
export const combineValidators =
  <V>(...validators: Array<(value: V) => ValidationResult>) =>
  (value: V): ValidationResult => {
    const results = validators.map(v => v(value))
    const errors = results.flatMap(r => r.errors)
    const effects = results.flatMap(r => r.effects ?? [])

    return {
      valid: results.every(r => r.valid),
      errors,
      effects: effects.length > 0 ? effects : undefined,
    }
  }

/**
 * Create a validator that only runs if condition is met
 */
export const conditionalValidator =
  <V>(condition: Condition<V>, validator: (value: V) => ValidationResult) =>
  (value: V): ValidationResult => {
    if (!condition(value)) {
      return { valid: true, errors: [] }
    }
    return validator(value)
  }
