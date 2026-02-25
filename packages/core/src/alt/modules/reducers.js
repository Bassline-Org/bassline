export default function (platform) {
  const {
    classes: { Resource },
    utils
  } = platform

  class Slot extends Resource {
    reduce = (_prev, curr) => curr
    constructor({ value = null, reduce }) {
      super()
      if (reduce) this.reduce = reduce
      this.value = value
    }
    get() {
      return this.value
    }
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

  class Max extends Slot {
    value = -Infinity
    reduce = Math.max
  }
  class Min extends Slot {
    value = Infinity
    reduce = Math.min
  }
  class Union extends Slot {
    value = new Set()
    constructor({ value } = {}) {
      super({})
      this.dispatch({ put: value })
    }
    reduce = (prev = new Set(), curr) => {
      if (prev.has(curr)
        || utils.isNil(curr)) return;
      if (typeof curr === 'string') return prev.add(curr)
      if (curr instanceof Set) {
        for (const val of curr.values()) {
          prev.add(val);
        }
        return prev
      }
      if (curr[Symbol.iterator]) {
        for (const val of curr) {
          prev.add(val)
        }
        return prev
      }
      prev.add(curr);
      return prev;
    }
  }

  platform.define({ Slot, Max, Min, Union })
}
