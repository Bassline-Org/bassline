import type React from 'react'
import type { ContainerSchema } from '@/magritte'

export const PRIORITY = {
  low: 100,
  med: 50,
  high: 10,
}

export type PhlowViewType<T = unknown> = Empty | NonEmptyView<T>
export type NonEmptyView<T> = Forward | List<T> | ColumnedList<T> | TextEditor | Explicit | Descriptor<T>
export interface IViewable {
  phlowViews: PhlowViewType<any>[]
}

export type Base = {
  title: string
  priority: number
}

export type Empty = {
  phlow: 'empty'
}
export type Forward = Base & {
  phlow: 'forward'
  target(): IViewable
  viewIndex?: number
}

export type List<T = unknown> = Base & {
  phlow: 'list'
  items(): T[]
  text(item: T): string
}
export type ColumnedList<T = unknown> = Base & {
  phlow: 'columnedList'
  items(): T[]
  columns: Record<string, Column<T>>
}
export type Column<T> = {
  text?: (item: T) => string
  icon?: (item: T) => string
}
export type TextEditor = Base & {
  phlow: 'textEditor'
  text: () => string
  onBlur?: (text: string) => void
  onChange?: (text: string) => void
}
export type Explicit = Base & {
  phlow: 'explicit'
  component: () => React.ReactNode
}

export type Descriptor<T = unknown> = Base & {
  phlow: 'descriptor'
  description: () => ContainerSchema
  model: () => T
  onUpdate?: (model: T) => void
}

export const phlow = {
  empty(): Empty {
    return { phlow: 'empty' }
  },

  forward(config: Omit<Forward, 'phlow' | 'priority'> & Partial<Pick<Forward, 'priority'>>): Forward {
    return { phlow: 'forward', priority: PRIORITY.low, ...config }
  },

  list<T>(config: Partial<Omit<List<T>, 'phlow'>> = {}): List<T> {
    return {
      phlow: 'list',
      title: 'a list',
      priority: PRIORITY.low,
      items: () => [],
      text: () => '',
      ...config,
    }
  },

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

  textEditor(config: Partial<Omit<TextEditor, 'phlow'>> = {}): TextEditor {
    return {
      phlow: 'textEditor',
      title: 'a text editor',
      priority: PRIORITY.low,
      text: () => '',
      ...config,
    }
  },

  explicit(config: Partial<Omit<Explicit, 'phlow'>> = {}): Explicit {
    return {
      phlow: 'explicit',
      title: 'explicit',
      priority: PRIORITY.low,
      component: () => null,
      ...config,
    }
  },

  descriptor<T>(
    config: Partial<Omit<Descriptor<T>, 'phlow'>> & {
      description: () => ContainerSchema
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
