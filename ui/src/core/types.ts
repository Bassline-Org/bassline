import type { ReactNode } from 'react'

/**
 * Configuration helper type for building views
 */
export type Config<View, Omitted extends keyof any = 'phlow'> = Partial<Omit<View, Omitted>>

/**
 * Union of all view types
 */
export type View<T = unknown> = Empty | NonEmptyView<T>

/**
 * All non-empty view types
 */
export type NonEmptyView<T> = Forward<T> | List<T> | ColumnedList<T> | TextEditor | Explicit | Descriptor<T> | Info

/**
 * Base properties shared by all non-empty views
 */
export type Base = {
  /** Display title for the view tab */
  title: string
  /** Lower number = higher priority (shown first) */
  priority: number
}

/**
 * Empty view - placeholder when no view is available
 */
export type Empty = { phlow: 'empty' }

/**
 * Forward view - delegates to another object's views
 */
export type Forward<T> = Base & {
  phlow: 'forward'
  /** Returns the view to display */
  view: () => View<T>
}

/**
 * List view - simple vertical list of items
 */
export type List<T = unknown> = Base & {
  phlow: 'list'
  /** Returns the items to display */
  items(): T[]
  /** Converts an item to display text */
  text(item: T): string
  /** Optional: returns a target to inspect when item is clicked */
  send?: (item: T) => unknown
}

/**
 * Info view - key-value pairs display
 */
export type Info = Base & {
  phlow: 'info'
  entries: {
    [key in string]: () => {
      text: string
      /** Optional target to inspect when entry is clicked */
      target?: unknown
    }
  }
}

/**
 * Column definition for columned list view
 */
export type Column<T> = {
  /** Converts item to column text */
  text?: (item: T) => string
  /** Converts item to icon (emoji or string) */
  icon?: (item: T) => string
  target: T
}

/**
 * Columned list view - tabular display with multiple columns
 */
export type ColumnedList<T = unknown> = Base & {
  phlow: 'columnedList'
  /** Returns the items to display */
  items(): T[]
  /** Column definitions keyed by column name */
  columns: Record<string, Column<T>>
  /** Optional: returns a target to inspect when row is clicked */
  send?: (item: T) => unknown
  /** Optional: returns a label for the breadcrumb when drilling down */
  sendLabel?: (item: T) => string
}

/**
 * Text editor view - editable text area
 */
export type TextEditor = Base & {
  phlow: 'textEditor'
  /** Returns the current text */
  text: () => string
  /** Called when text area loses focus */
  onBlur?: (text: string) => void
  /** Called on every text change */
  onChange?: (text: string) => void
}

/**
 * Explicit view - renders a custom React component
 */
export type Explicit = Base & {
  phlow: 'explicit'
  /** Returns the React component to render */
  component: () => ReactNode
}

/**
 * Schema type for descriptor views (optional Zod integration)
 * When Zod is not available, this is a placeholder type
 */
export type DescriptorSchema = {
  parse: (data: unknown) => unknown
  safeParse: (data: unknown) => { success: boolean; data?: unknown; error?: unknown }
}

/**
 * Descriptor view - form-based editing with schema validation
 */
export type Descriptor<T = unknown> = Base & {
  phlow: 'descriptor'
  /** Returns the validation schema */
  schema: () => DescriptorSchema
  /** Returns the current model data */
  model: () => T
  /** Called when user submits the form */
  onUpdate?: (model: T) => void
}
