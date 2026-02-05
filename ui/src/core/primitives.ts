import { phlow, phlowViews } from './phlow'

/**
 * Adds default phlow views to Array.prototype.
 * Call this once at app startup to enable inspection of arrays.
 */
export function addArrayViews(): void {
  Reflect.defineProperty(Array.prototype, phlowViews, {
    value: function (this: unknown[]) {
      return [
        phlow.info({
          title: 'Array',
          entries: {
            length: () => ({
              text: this.length.toString(),
            }),
            json: () => ({
              text: JSON.stringify(this),
            }),
          },
        }),
      ]
    },
    configurable: true,
    writable: true,
  })
}

/**
 * Adds default phlow views to Object.prototype.
 * Call this once at app startup to enable inspection of plain objects.
 */
export function addObjectViews(): boolean {
  return Reflect.defineProperty(Object.prototype, phlowViews, {
    value: function (this: object) {
      return [
        phlow.info({
          title: 'Object',
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
      ]
    },
    configurable: true,
    writable: true,
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
