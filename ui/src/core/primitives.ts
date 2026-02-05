import { phlow, phlowViews, type Viewable, type ViewProducer } from './phlow'

// ============================================================================
// Primitive Wrapper Classes
// ============================================================================

/**
 * Viewable wrapper for string values.
 * Use this to inspect primitive strings that can't have prototype methods.
 */
export class ViewableString implements Viewable<string> {
  constructor(public value: string) {}

  [phlowViews]: ViewProducer<string>[] = [
    () =>
      phlow.info({
        title: 'Info',
        priority: 1,
        entries: {
          value: () => ({ text: this.value }),
          length: () => ({ text: this.value.length.toString() }),
          trimmed: () => ({ text: this.value.trim() }),
        },
      }),
    () =>
      phlow.list<string>({
        title: 'Characters',
        priority: 2,
        items: () => this.value.split(''),
        text: char => `"${char}" (${char.charCodeAt(0)})`,
      }),
  ]
}

/**
 * Viewable wrapper for number values.
 * Use this to inspect primitive numbers that can't have prototype methods.
 */
export class ViewableNumber implements Viewable<number> {
  constructor(public value: number) {}

  [phlowViews]: ViewProducer<number>[] = [
    () => {
      const info = (v: any) => () => ({ text: v.toString(), target: v })
      const value = info(this.value.toString())
      const hex = info(`0x${this.value.toString(16)}`)
      const binary = info(`0b${this.value.toString(2)}`)
      const octal = info(`0o${this.value.toString(8)}`)
      const isInteger = info(Number.isInteger(this.value))
      const isFinite = info(Number.isFinite(this.value))
      const isNaN = info(Number.isNaN(this.value))
      return phlow.info({
        title: 'Info',
        priority: 1,
        entries: {
          value,
          hex,
          binary,
          octal,
          isInteger,
          isFinite,
          isNaN,
        },
      })
    },
  ]
}

/**
 * Viewable wrapper for boolean values.
 */
export class ViewableBoolean implements Viewable<boolean> {
  constructor(public value: boolean) {}

  [phlowViews]: ViewProducer<boolean>[] = [
    () =>
      phlow.info({
        title: 'Info',
        priority: 1,
        entries: {
          value: () => ({ text: this.value.toString() }),
        },
      }),
  ]
}

// ============================================================================
// Prototype Extensions
// ============================================================================

/**
 * Adds default phlow views to Array.prototype.
 * Call this once at app startup to enable inspection of arrays.
 */
export function addArrayViews(): void {
  Reflect.defineProperty(Array.prototype, phlowViews, {
    get: function (this: unknown[]) {
      // Return array of producer functions
      // Use getter so `this` is bound correctly each time
      return [
        () =>
          phlow.info({
            title: 'Info',
            priority: 1,
            entries: {
              length: () => ({
                text: this.length.toString(),
              }),
              json: () => ({
                text: JSON.stringify(this),
              }),
            },
          }),
        () =>
          phlow.list<unknown>({
            title: 'Items',
            priority: 2,
            items: () => this,
            text: item => JSON.stringify(item),
          }),
      ]
    },
    configurable: true,
  })
}

/**
 * Adds default phlow views to Object.prototype.
 * Call this once at app startup to enable inspection of plain objects.
 */
export function addObjectViews(): boolean {
  return Reflect.defineProperty(Object.prototype, phlowViews, {
    get: function (this: object) {
      // Return array of producer functions
      // Use getter so `this` is bound correctly each time
      return [
        () =>
          phlow.info({
            title: 'Object',
            priority: 1,
            entries: {
              size: () => ({
                text: Object.keys(this).length.toString(),
              }),
              prototype: () => {
                const proto = Object.getPrototypeOf(this)
                return {
                  text: proto?.constructor?.name ?? String(proto),
                  target: proto,
                }
              },
              keys: () => {
                const keys = Object.keys(this)
                return {
                  text: keys.join(', '),
                  target: keys,
                }
              },
              extensible: () => ({
                text: Object.isExtensible(this).toString(),
              }),
            },
          }),
        () =>
          phlow.columnedList<[string, unknown]>({
            title: 'Properties',
            priority: 2,
            items: () => Object.entries(this),
            columns: {
              key: { text: ([k]) => k },
              type: { text: ([, v]) => typeof v },
              value: { text: ([, v]) => String(v) },
            },
          }),
      ]
    },
    configurable: true,
  })
}

/**
 * Initialize all primitive view extensions.
 * Call this once at app startup.
 */
export function initPrimitiveViews(): void {
  addArrayViews()
  addObjectViews()
}
