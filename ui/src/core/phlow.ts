import type { ViewContainer, ActionContainer, SearchContainer } from './container'

/**
 * Priority levels for view ordering.
 * Lower numbers = higher priority (shown first in tabs)
 */
export const PRIORITY = {
  /** Primary/most important views */
  high: 10,
  /** Important but not primary views */
  med: 50,
  /** Default/fallback views */
  low: 100,
} as const

/**
 * Well-known symbol for declaring views on objects.
 * Objects implement Viewable by defining a ViewContainer with this symbol key.
 */
export const phlowViews = Symbol.for('$$PHLOW_VIEWS$$')

/**
 * Well-known symbol for declaring actions on objects.
 * Objects implement Actionable by defining an ActionContainer with this symbol key.
 */
export const phlowActions = Symbol.for('$$PHLOW_ACTIONS$$')

/**
 * Well-known symbol for declaring search sources on objects.
 * Objects implement Searchable by defining a SearchContainer with this symbol key.
 */
export const phlowSearches = Symbol.for('$$PHLOW_SEARCHES$$')

// ============================================================================
// Inheritance Control
// ============================================================================

export const phlowInheritViews = Symbol.for('$$PHLOW_INHERIT_VIEWS$$')

export function shouldInheritViews(obj: unknown): boolean {
  if (obj === null || typeof obj !== 'object') return false
  return (obj as any)[phlowInheritViews] ?? true
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Interface for objects that can be inspected via views.
 *
 * @example
 * class MyClass implements Viewable<MyClass> {
 *   [phlowViews] = views<MyClass>()
 *     .info(self => ({ title: 'Info', entries: { ... } }))
 * }
 */
export interface Viewable<T = unknown> {
  [phlowViews]: ViewContainer<T>
}

/**
 * Interface for objects that have actions.
 *
 * @example
 * class MyClass implements Actionable<MyClass> {
 *   [phlowActions] = actions<MyClass>()
 *     .button(self => ({ label: 'Save', onClick: () => self.save() }))
 * }
 */
export interface Actionable<T = unknown> {
  [phlowActions]?: ActionContainer<T>
}

/**
 * Interface for objects that have search sources.
 *
 * @example
 * class MyClass implements Searchable<MyClass> {
 *   [phlowSearches] = searches<MyClass>()
 *     .source(self => ({ title: 'Items', items: q => ..., text: i => ... }))
 * }
 */
export interface Searchable<T = unknown> {
  [phlowSearches]?: SearchContainer<T>
}

/**
 * Combined interface for objects that can have views, actions, and search.
 */
export interface Inspectable<T = unknown> extends Viewable<T>, Actionable<T>, Searchable<T> {}

// ============================================================================
// Type Guards
// ============================================================================

function isContainer(val: unknown): boolean {
  return val !== null && typeof val === 'object' && Array.isArray((val as any).factories)
}

export function isViewable(obj: unknown): obj is Viewable<unknown> {
  if (obj === null || typeof obj !== 'object') return false
  return isContainer((obj as any)[phlowViews])
}

export function hasActions(obj: unknown): obj is Actionable<unknown> {
  if (obj === null || typeof obj !== 'object') return false
  return isContainer((obj as any)[phlowActions])
}

export function isSearchable(obj: unknown): obj is Searchable<unknown> {
  if (obj === null || typeof obj !== 'object') return false
  return isContainer((obj as any)[phlowSearches])
}
