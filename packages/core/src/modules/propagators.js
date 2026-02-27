/** @param {import('../types').Platform} platform */
export default function (platform) {
  const kResource = Symbol.for('bassline.resource')
  const {
    classes: { Scope },
  } = platform

  class Propagator extends Scope {
    /** @type {Set<string>} */
    #keys

    #scheduled = false

    /** @type {Map<string, import('../platform').Resource>} */
    #watched = new Map()

    /** @type {(() => void) | null} */
    #unsub = null

    constructor({ cells = {}, body } = {}) {
      super()
      this.#keys = new Set(Object.keys(cells))
      if (body) this.body = body
      for (const [name, value] of Object.entries(cells)) {
        if (value != null) this.put(value, { at: name })
      }
    }

    /**
     * @param {Record<string, import('../types').ResourceFn>} _bindings
     */
    body(_bindings) {
      throw new Error('body not implemented')
    }

    /**
     * @param {Error} error
     */
    onError(error) {
      this.announce('error', { error })
    }

    /**
     * @param {Record<string, import('../types').ResourceFn | null>} cells
     * @returns {boolean}
     */
    shouldActivate(cells) {
      return Object.values(cells).every(v => v != null)
    }

    get keys() {
      return this.#keys
    }

    /**
     * Schedule execution. Override for custom scheduling (synchronous, debounced, etc).
     */
    run() {
      if (this.#scheduled) return
      this.#scheduled = true
      queueMicrotask(() => {
        this.#scheduled = false
        this.execute()
      })
    }

    /**
     * Build bindings and call body. Override for custom execution logic.
     */
    execute() {
      if (this.#keys.size === 0) return
      const bindings = {}
      for (const key of this.#keys) {
        bindings[key] = super.get({ has: key }) ? super.get({ at: key }) : null
      }
      if (!this.shouldActivate(bindings)) return
      try {
        this.body(bindings)
        this.announce('propagated', {})
      } catch (error) {
        this.onError(error)
      }
    }

    fire() {
      this.run()
    }

    put(body, headers = {}) {
      const { at } = headers
      if (at == null) throw new Error('at required')
      if (!this.#keys.has(at)) throw new Error(`unknown key: ${at}`)
      if (body !== null && typeof body !== 'function') {
        throw new Error('propagator cells must be resource functions or null')
      }

      this.#watched.delete(at)
      const result = super.put(body, headers)
      if (body != null && body[kResource]) {
        this.#watched.set(at, body[kResource])
        this.#ensureListener()
      } else if (this.#watched.size === 0 && this.#unsub) {
        this.#unsub()
        this.#unsub = null
      }

      this.run()
      return result
    }

    #ensureListener() {
      if (this.#unsub) return
      this.#unsub = platform.on('resource.changed', e => {
        for (const resource of this.#watched.values()) {
          if (resource === e.resource) {
            this.run()
            return
          }
        }
      })
    }

    get(msg = {}) {
      const { at, has, walk, meta } = msg
      if (walk !== undefined) return super.get(msg)
      if (meta !== undefined) return super.get(msg)
      if (has !== undefined) {
        if (!this.#keys.has(has)) return false
        return super.get({ has })
      }
      if (at !== undefined) {
        if (!this.#keys.has(at)) throw new Error(`unknown key: ${at}`)
        return super.get({ at })
      }
      const { hrefs } = super.get({})
      return { hrefs, keys: [...this.#keys] }
    }

    accept(aVisitor) {
      return aVisitor.visitPropagator?.(this) ?? aVisitor.visitScope?.(this) ?? super.accept(aVisitor)
    }
  }

  platform.define({ Propagator })
}
