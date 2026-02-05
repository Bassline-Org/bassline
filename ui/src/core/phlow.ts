import type {
  Empty,
  Forward,
  List,
  ColumnedList,
  TextEditor,
  Explicit,
  Descriptor,
  Config,
  View,
  Info,
  DescriptorSchema,
} from './types'

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
 * Objects implement Viewable by defining an array of view producer functions with this symbol key.
 */
export const phlowViews = Symbol.for('$$PHLOW_VIEWS$$')

/**
 * A function that produces a view.
 * Views are produced lazily to allow dynamic registration and fresh data.
 */
export type ViewProducer<T = unknown> = () => View<T>

/**
 * Interface for objects that can be inspected.
 * Implement this by adding a [phlowViews] property that is an array of view producer functions.
 *
 * @example
 * class MyClass implements Viewable<MyClass> {
 *   [phlowViews] = [
 *     () => phlow.info({ title: 'Info', ... }),
 *     () => phlow.list({ title: 'List', ... }),
 *   ]
 * }
 *
 * // Dynamic view addition:
 * obj[phlowViews].push(() => phlow.explicit({ ... }))
 */
export interface Viewable<T = unknown> {
  [phlowViews]: ViewProducer<T>[]
}

/**
 * Type guard to check if an object is Viewable
 */
export function isViewable(obj: unknown): obj is Viewable<unknown> {
  return obj !== null && typeof obj === 'object' && phlowViews in obj && Array.isArray((obj as any)[phlowViews])
}

/**
 * Factory functions for creating view definitions.
 * Each method returns a view object with sensible defaults that can be overridden.
 */
export const phlow = {
  /**
   * Create an empty view (placeholder/null view)
   */
  empty(): Empty {
    return { phlow: 'empty' }
  },

  /**
   * Create a forward view that delegates to another object's views
   */
  forward<T>(config: Config<Forward<T>, 'phlow' | 'priority'>): Forward<T> {
    return {
      phlow: 'forward',
      priority: PRIORITY.low,
      title: 'forwarded',
      view: () => phlow.empty(),
      ...config,
    }
  },

  /**
   * Create a simple list view
   */
  list<T>(config: Config<List<T>> = {}): List<T> {
    return {
      phlow: 'list',
      title: 'a list',
      priority: PRIORITY.low,
      items: () => [],
      text: () => '',
      ...config,
    }
  },

  /**
   * Create a columned list (table) view
   */
  columnedList<T>(config: Partial<Omit<ColumnedList<T>, 'phlow'>> = {}): ColumnedList<T> {
    return {
      phlow: 'columnedList',
      title: 'a columned list',
      priority: PRIORITY.low,
      items: () => [],
      columns: {},
      ...config,
    }
  },

  /**
   * Create an info (key-value pairs) view
   */
  info(config: Config<Info>): Info {
    return {
      phlow: 'info',
      title: 'info',
      priority: PRIORITY.low,
      entries: {},
      ...config,
    }
  },

  /**
   * Create a text editor view
   */
  textEditor(config: Partial<Omit<TextEditor, 'phlow'>> = {}): TextEditor {
    return {
      phlow: 'textEditor',
      title: 'a text editor',
      priority: PRIORITY.low,
      text: () => '',
      ...config,
    }
  },

  /**
   * Create an explicit (custom React component) view
   */
  explicit(config: Partial<Omit<Explicit, 'phlow'>> = {}): Explicit {
    return {
      phlow: 'explicit',
      title: 'explicit',
      priority: PRIORITY.low,
      component: () => null,
      ...config,
    }
  },

  /**
   * Create a descriptor (form-based) view with schema validation
   */
  descriptor<T>(
    config: Partial<Omit<Descriptor<T>, 'phlow'>> & {
      schema: () => DescriptorSchema
      model: () => T
    }
  ): Descriptor<T> {
    return {
      phlow: 'descriptor',
      title: 'properties',
      priority: PRIORITY.low,
      ...config,
    }
  },
}
