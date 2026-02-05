import { phlow, phlowViews } from './phlow'

export function addArrayViews() {
  Reflect.defineProperty(Array.prototype, phlowViews, {
    value: function (this: typeof Array.prototype) {
      return [
        phlow.info({
          entries: {
            length: () =>
              ({
                text: this.length.toString(),
              }) as const,
            json: () =>
              ({
                text: JSON.stringify(this),
              }) as const,
          },
        }),
      ]
    },
  })
}

export function addObjectViews() {
  return Reflect.defineProperty(Object.prototype, phlowViews, {
    value: function (this: typeof Object.prototype) {
      return [
        phlow.info({
          entries: {
            size: () => ({ text: Object.keys(this).length.toString() }) as const,
            prototype: () => {
              const proto = Object.getPrototypeOf(this)
              return {
                text: proto.toString(),
                target: proto,
              }
            },
            keys: () => {
              const keys = Object.keys(this)
              return {
                text: keys.toString(),
                target: keys,
              } as const
            },
            extensible: () => ({
              text: Object.isExtensible(this).toString(),
            }),
          },
        }),
      ]
    },
  })
}
