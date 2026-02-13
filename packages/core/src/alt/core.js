import { DNU, KeyNotFound } from './errors.js'
const RESOURCE = Symbol.for('$$_RESOURCE_$$');

function isResource(v) {
  return v && v[RESOURCE]
}

function resource(options) {
  const defaultOptions = {
    dnu(msg) {
      throw new DNU(this, msg)
    },
    get(msg) {
      return this.dnu(msg)
    },
    put(put, msg) {
      return this.dnu({ put, ...msg })
    },
    _resource,
  }
  function _resource(msg = {}) {
    if ('put' in msg) {
      const { put: body, ...rest } = msg
      return _resource.options.put?.(body, rest)
    } else {
      return _resource.options.get(msg)
    }
  }
  _resource[RESOURCE] = true
  _resource.options = Object.assign(defaultOptions, options ?? {})
  return _resource
}

function slot(value) {
  return resource({
    value,
    get() {
      return this.value
    },
    put(incoming) {
      this.value = incoming
      return this.value
    },
  })
}

function adapt(target, options = {}) {
  return resource({
    target,
    input(msg) {
      return msg
    },
    output(result) {
      return result
    },
    dnu(msg) {
      const result = this.target(this.input(msg))
      return result?.then ? result.then(r => this.output(r)) : this.output(result)
    },
    ...options,
  })
}

function pipe(...fns) {
  return x => fns.reduce((v, f) => f(v), x)
}

function watchable(target) {
  return adapt(target, {
    watchers: new Set(),
    get(msg) {
      if (msg.watch) {
        this.watchers.add(msg.watch)
        return
      }
      if (msg.unwatch) {
        this.watchers.delete(msg.unwatch)
        return
      }
      return this.target(msg)
    },
    put(value, rest) {
      const prev = this.target()
      const result = this.target({ put: value, ...rest })
      for (const w of this.watchers) w({ put: { changed: result, prev } })
      return result
    },
  })
}

function slots() {
  return resource({
    slots: new Map(),
    notFound(key) {
      throw new KeyNotFound(this, key)
    },
    has(key) {
      return this.slots.has(key)
    },
    get(msg) {
      const { at: key, ifAbsentPut: fallback } = msg
      if (!key) this.dnu(msg)
      let s = this.slots.get(key)
      if (!s && fallback) {
        s = slot(fallback)
        this.slots.set(key, s)
      }
      if (!s) this.notFound(key)
      return s()
    },
    put(value, msg) {
      const { at: key } = msg
      if (!key) this.dnu(msg)
      if (value === null) return this.slots.delete(key)
      if (!this.has(key)) this.slots.set(key, slot())
      const s = this.slots.get(key)
      return s({ put: value })
    },
  })
}

export { RESOURCE, isResource, resource, slot, slots, adapt, pipe, watchable }