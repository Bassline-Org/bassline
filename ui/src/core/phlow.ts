import type { ComponentType, ReactNode } from 'react'
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
  Tool,
  EmptyTool,
  WindowTool,
  ToolProps,
  Action,
  EmptyAction,
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
 * Well-known symbol for declaring tools on objects.
 * Tools are complete applications for interacting with an object (inspector is the default tool).
 */
export const phlowTools = Symbol.for('$$PHLOW_TOOLS$$')

/**
 * Well-known symbol for declaring actions on objects.
 * Actions are buttons that appear in the inspector and trigger behaviors.
 */
export const phlowActions = Symbol.for('$$PHLOW_ACTIONS$$')

// ============================================================================
// Inheritance Control Symbols
// ============================================================================

/**
 * Symbol to control view inheritance from prototype chain.
 * Set to false on an object to prevent inheriting views from prototypes.
 * Default behavior (when not set): true (inherit views)
 */
export const phlowInheritViews = Symbol.for('$$PHLOW_INHERIT_VIEWS$$')

/**
 * Symbol to control action inheritance from prototype chain.
 * Set to false on an object to prevent inheriting actions from prototypes.
 * Default behavior (when not set): true (inherit actions)
 */
export const phlowInheritActions = Symbol.for('$$PHLOW_INHERIT_ACTIONS$$')

/**
 * Symbol to control tool inheritance from prototype chain.
 * Set to false on an object to prevent inheriting tools from prototypes.
 * Default behavior (when not set): true (inherit tools)
 */
export const phlowInheritTools = Symbol.for('$$PHLOW_INHERIT_TOOLS$$')

// ============================================================================
// Inheritance Helpers
// ============================================================================

/**
 * Check if an object should inherit from prototype chain for a given symbol.
 * Returns true by default (when symbol is not set).
 */
function shouldInherit(obj: unknown, symbol: symbol): boolean {
  if (obj === null || typeof obj !== 'object') return false
  return (obj as any)[symbol] ?? true
}

/** Check if views should be inherited from prototype chain */
export const shouldInheritViews = (obj: unknown): boolean => shouldInherit(obj, phlowInheritViews)

/** Check if actions should be inherited from prototype chain */
export const shouldInheritActions = (obj: unknown): boolean => shouldInherit(obj, phlowInheritActions)

/** Check if tools should be inherited from prototype chain */
export const shouldInheritTools = (obj: unknown): boolean => shouldInherit(obj, phlowInheritTools)

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
 * A function that produces a tool.
 * Tools are produced lazily to allow conditional display.
 */
export type ToolProducer<T = unknown> = () => Tool<T>

/**
 * Interface for objects that have tools.
 * Tools are complete applications (inspector is the default tool).
 */
export interface Toolable<T = unknown> {
  [phlowTools]?: ToolProducer<T>[]
}

/**
 * A function that produces an action.
 * Actions are produced lazily to allow conditional display.
 */
export type ActionProducer = () => Action

/**
 * Interface for objects that have actions.
 * Actions are buttons that trigger behaviors.
 */
export interface Actionable {
  [phlowActions]?: ActionProducer[]
}

/**
 * Combined interface for objects that can have views, tools, and actions.
 */
export interface Inspectable<T = unknown> extends Viewable<T>, Toolable<T>, Actionable {}

/**
 * Type guard to check if an object is Viewable
 */
export function isViewable(obj: unknown): obj is Viewable<unknown> {
  return obj !== null && typeof obj === 'object' && phlowViews in obj && Array.isArray((obj as any)[phlowViews])
}

/**
 * Type guard to check if an object has tools
 */
export function hasTools(obj: unknown): obj is Toolable<unknown> {
  return obj !== null && typeof obj === 'object' && phlowTools in obj && Array.isArray((obj as any)[phlowTools])
}

/**
 * Type guard to check if an object has actions
 */
export function hasActions(obj: unknown): obj is Actionable {
  return obj !== null && typeof obj === 'object' && phlowActions in obj && Array.isArray((obj as any)[phlowActions])
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

/**
 * Factory functions for creating tool definitions.
 * Tools are complete applications for interacting with objects.
 */
export const tool = {
  /**
   * Create an empty tool (for conditional display - tool won't be shown)
   *
   * @example
   * // Only show player for audio files
   * [phlowTools] = [
   *   () => this.path.endsWith('.mp3')
   *     ? tool.window({ id: 'player', title: 'Player', component: AudioPlayer })
   *     : tool.empty()
   * ]
   */
  empty(): EmptyTool {
    return { phlow: 'emptyTool' }
  },

  /**
   * Create a window tool (a complete application view)
   */
  window<T>(config: {
    id: string
    title: string
    priority?: number
    icon?: ReactNode
    component: ComponentType<ToolProps<T>>
  }): WindowTool<T> {
    return {
      phlow: 'windowTool',
      id: config.id,
      title: config.title,
      priority: config.priority ?? PRIORITY.med,
      icon: config.icon,
      component: config.component,
    }
  },
}

/**
 * Factory functions for creating action definitions.
 * Actions are buttons that trigger behaviors.
 */
export const action = {
  /**
   * Create an empty action (for conditional display - action won't be shown)
   */
  empty(): EmptyAction {
    return { phlow: 'emptyAction' }
  },

  /**
   * Create a button action
   *
   * @example
   * [phlowActions] = [
   *   () => action.button({
   *     label: 'Save',
   *     icon: <SaveIcon />,
   *     onClick: async () => await save()
   *   })
   * ]
   */
  button(config: {
    label: string
    icon?: ReactNode
    tooltip?: string
    priority?: number
    enabled?: () => boolean
    onClick: () => void | Promise<void>
  }): Action {
    return {
      phlow: 'buttonAction',
      label: config.label,
      icon: config.icon,
      tooltip: config.tooltip,
      priority: config.priority ?? PRIORITY.med,
      enabled: config.enabled,
      onClick: config.onClick,
    }
  },
}
