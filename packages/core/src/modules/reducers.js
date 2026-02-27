/** @param {import('../types').Platform} platform */
export default function (platform) {
  const {
    classes: { Resource },
    utils,
  } = platform

  /**
   * State with a reducer. The reducer defines what "write" means.
   *
   * Default reducer is last-write-wins. Pass a custom `reduce(prev, curr)`
   * to define merge behavior (e.g. Math.max, Math.min).
   */
  class Slot extends Resource {
    /**
     * @param {unknown} _prev
     * @param {unknown} curr
     * @returns {unknown}
     */
    reduce = (_prev, curr) => curr

    /**
     * @param {object} [options]
     * @param {unknown} [options.value] - Initial value
     * @param {(prev: unknown, curr: unknown) => unknown} [options.reduce] - Reducer function
     */
    constructor({ value = null, reduce } = {}) {
      super()
      if (reduce) this.reduce = reduce
      this.value = value
    }

    /** @returns {unknown} */
    get() {
      return this.value
    }

    /**
     * @param {unknown} current
     * @returns {unknown}
     */
    put(current) {
      const previous = this.value
      const reduced = this.reduce(previous, current)
      if (reduced !== previous) {
        this.value = reduced
        this.announce('changed', { resource: this, previous, current: reduced })
      }
      return this.value
    }
  }

  /** Slot that keeps the maximum value. */
  class Max extends Slot {
    constructor({ value = -Infinity, reduce = Math.max } = {}) {
      super({ value, reduce })
    }
  }

  /** Slot that keeps the minimum value. */
  class Min extends Slot {
    constructor({ value = Infinity, reduce = Math.min } = {}) {
      super({ value, reduce })
    }
  }

  /** Slot that accumulates a Set of values. */
  class Union extends Slot {
    value = new Set()

    /**
     * @param {object} [options]
     * @param {unknown} [options.value]
     */
    constructor({ value } = {}) {
      super({})
      this.dispatch({ put: value })
    }

    /**
     * @param {Set<unknown>} [prev]
     * @param {unknown} curr
     * @returns {Set<unknown>}
     */
    reduce = (prev = new Set(), curr) => {
      if (prev.has(curr) || utils.isNil(curr)) return prev
      const next = new Set(prev)
      if (typeof curr === 'string') {
        next.add(curr)
        return next
      }
      if (curr instanceof Set) {
        for (const val of curr.values()) next.add(val)
        return next
      }
      if (curr[Symbol.iterator]) {
        for (const val of curr) next.add(val)
        return next
      }
      next.add(curr)
      return next
    }
  }

  platform.define({ Slot, Max, Min, Union })
}
