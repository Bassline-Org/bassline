import { phlowViews, PRIORITY, type Viewable } from './phlow'
import { views } from './container'
import { PromiseView } from '../react/views/PromiseView'
import React from 'react'

// ============================================================================
// Primitive Wrapper Classes
// ============================================================================

/**
 * Viewable wrapper for string values.
 */
export class ViewableString implements Viewable<ViewableString> {
  constructor(public value: string) {}

  [phlowViews] = views<ViewableString>()
    .info(self => ({
      title: 'Info',
      priority: 1,
      entries: {
        value: () => ({ text: self.value, value: self.value }),
        length: () => ({ text: self.value.length.toString(), value: self.value.length }),
        trimmed: () => ({ text: self.value.trim(), value: self.value.trim() }),
      },
    }))
    .list(self => ({
      title: 'Characters',
      priority: 2,
      items: () => self.value.split(''),
      text: (char: string) => `"${char}" (${char.charCodeAt(0)})`,
    }))
}

/**
 * Viewable wrapper for number values.
 */
export class ViewableNumber implements Viewable<ViewableNumber> {
  constructor(public value: number) {}

  [phlowViews] = views<ViewableNumber>().info(self => {
    const info = (v: any) => () => ({ text: v.toString(), target: v })
    return {
      title: 'Info',
      priority: 1,
      entries: {
        value: info(self.value.toString()),
        hex: info(`0x${self.value.toString(16)}`),
        binary: info(`0b${self.value.toString(2)}`),
        octal: info(`0o${self.value.toString(8)}`),
        isInteger: info(Number.isInteger(self.value)),
        isFinite: info(Number.isFinite(self.value)),
        isNaN: info(Number.isNaN(self.value)),
      },
    }
  })
}

/**
 * Viewable wrapper for boolean values.
 */
export class ViewableBoolean implements Viewable<ViewableBoolean> {
  constructor(public value: boolean) {}

  [phlowViews] = views<ViewableBoolean>().info(self => ({
    title: 'Info',
    priority: 1,
    entries: {
      value: () => ({ text: self.value.toString(), value: self.value }),
    },
  }))
}

/**
 * Viewable wrapper for array values.
 */
export class ViewableArray implements Viewable<ViewableArray> {
  constructor(public value: unknown[]) {}

  [phlowViews] = views<ViewableArray>()
    .info(self => ({
      title: 'Array',
      priority: PRIORITY.high,
      entries: {
        length: () => ({ text: self.value.length.toString(), value: self.value.length }),
        json: () => ({ text: JSON.stringify(self.value), value: self.value }),
      },
    }))
    .list(self => ({
      title: 'Items',
      priority: PRIORITY.med,
      items: () => self.value,
      text: (item: unknown) => JSON.stringify(item),
    }))
}

/**
 * Viewable wrapper for object values.
 */
export class ViewableObject implements Viewable<ViewableObject> {
  constructor(public value: object) {}

  [phlowViews] = views<ViewableObject>()
    .info(self => ({
      title: 'Object',
      priority: PRIORITY.high,
      entries: {
        size: () => ({ text: Object.keys(self.value).length.toString(), value: Object.keys(self.value).length }),
        prototype: () => {
          const proto = Object.getPrototypeOf(self.value)
          return { text: proto?.constructor?.name ?? String(proto), target: proto }
        },
        keys: () => {
          const keys = Object.keys(self.value)
          return { text: keys.join(', '), target: keys }
        },
      },
    }))
    .columnedList(self => ({
      title: 'Properties',
      priority: PRIORITY.med,
      items: () => Object.entries(self.value),
      columns: {
        key: { text: ([k]: [string, unknown]) => k },
        type: { text: ([, v]: [string, unknown]) => typeof v },
        value: { text: ([, v]: [string, unknown]) => String(v) },
      },
      send: ([, v]: [string, unknown]) => v,
      sendLabel: ([k]: [string, unknown]) => k,
    }))
}

/**
 * Viewable wrapper for Promise values.
 */
export class ViewablePromise implements Viewable<ViewablePromise> {
  constructor(public value: Promise<unknown>) {}

  [phlowViews] = views<ViewablePromise>().explicit(self => ({
    title: 'Loading...',
    priority: PRIORITY.high,
    component: () => React.createElement(PromiseView, { promise: self.value }),
  }))
}
