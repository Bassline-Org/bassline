import { isViewable, type Viewable } from './phlow'
import { ViewableString, ViewableNumber, ViewableBoolean } from './primitives'

/**
 * Wrap a value in a Viewable wrapper if needed.
 * - If already Viewable, returns as-is
 * - Primitives (string, number, boolean) get wrapped in ViewableX classes
 * - null/undefined return null
 * - Objects/arrays should be Viewable via prototype extension (if initPrimitiveViews was called)
 */
export function inspect(value: unknown): Viewable<unknown> | null {
  if (value === null || value === undefined) {
    return null
  }

  if (isViewable(value)) {
    return value
  }

  if (typeof value === 'string') {
    return new ViewableString(value) as Viewable<unknown>
  }

  if (typeof value === 'number') {
    return new ViewableNumber(value) as Viewable<unknown>
  }

  if (typeof value === 'boolean') {
    return new ViewableBoolean(value) as Viewable<unknown>
  }

  // Objects and arrays should already be Viewable via prototype extension
  // But if initPrimitiveViews() wasn't called, they won't be
  return null
}

/**
 * Check if a value can be inspected (is Viewable or can be wrapped as one).
 * This is useful for determining if an item should be clickable.
 */
export function canInspect(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false
  }

  if (isViewable(value)) {
    return true
  }

  // Primitives can always be wrapped
  const type = typeof value
  return type === 'string' || type === 'number' || type === 'boolean'
}
