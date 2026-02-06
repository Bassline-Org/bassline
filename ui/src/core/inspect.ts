import { phlowViews, type Viewable } from './phlow'
import {
  ViewableString,
  ViewableNumber,
  ViewableBoolean,
  ViewableArray,
  ViewableObject,
  ViewablePromise,
} from './primitives'

/**
 * Wrap a value in a Viewable wrapper if needed.
 * - If it has [phlowViews], returns as-is (already viewable)
 * - Primitives (string, number, boolean) get wrapped in ViewableX classes
 * - Arrays get wrapped in ViewableArray
 * - Promises get wrapped in ViewablePromise
 * - Plain objects get wrapped in ViewableObject
 * - null/undefined return null
 */
export function inspect(value: unknown): Viewable<unknown> | null {
  if (value === null || value === undefined) {
    return null
  }

  // Anything with the phlowViews symbol is already viewable
  if (typeof value === 'object' && value !== null && phlowViews in (value as object)) {
    return value as Viewable<unknown>
  }

  switch (typeof value) {
    case 'string':
      return new ViewableString(value) as Viewable<unknown>
    case 'number':
      return new ViewableNumber(value) as Viewable<unknown>
    case 'boolean':
      return new ViewableBoolean(value) as Viewable<unknown>
  }

  if (value instanceof Promise) {
    return new ViewablePromise(value) as Viewable<unknown>
  }

  if (Array.isArray(value)) {
    return new ViewableArray(value) as Viewable<unknown>
  }

  if (typeof value === 'object') {
    return new ViewableObject(value as object) as Viewable<unknown>
  }

  return null
}

/**
 * Check if a value can be inspected.
 */
export function canInspect(value: unknown): boolean {
  return inspect(value) !== null
}
