import type { z } from 'zod'
import { Empty, Forward, List, ColumnedList, TextEditor, Explicit, Descriptor, Config, View, Info } from './types'
export const PRIORITY = {
  low: 100,
  med: 50,
  high: 10,
}
export const phlowViews = Symbol.for('$$PHLOW_VIEWS$$')
export interface Viewable<T = unknown> {
  [phlowViews](): View<T>[]
}

export const phlow = {
  empty(): Empty {
    return { phlow: 'empty' }
  },

  forward<T>(config: Config<Forward<T>, 'phlow' | 'priority'>): Forward<T> {
    return { phlow: 'forward', priority: PRIORITY.low, title: 'forwarded', view: () => phlow.empty(), ...config }
  },

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

  info(config: Config<Info>): Info {
    return {
      phlow: 'info',
      title: 'info',
      priority: PRIORITY.low,
      entries: {},
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
      schema: () => z.ZodObject<z.ZodRawShape>
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
