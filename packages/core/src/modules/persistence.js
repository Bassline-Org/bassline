/**
 * Persistence module — backs Slot and Scope with a storage adapter.
 *
 * Storage adapter interface:
 *   { get(key): unknown, set(key, value): void, delete(key): void, list(): string[] }
 *
 * PersistentSlot: loads lazily on first read, saves on every change.
 * PersistentScope: persists its child structure. Entries are serialized as
 *   { type: 'slot', value } or { type: 'scope' }.
 *
 * Note: custom reducers are not persisted. Restored slots use last-write-wins.
 * For custom reducers, use a reducer registry or mount PersistentSlots directly
 * with the desired reducer.
 *
 * @param {import('../types').Platform} platform
 */
export default function persistence(platform) {
  const {
    classes: { Slot, Scope },
  } = platform

  /**
   * In-memory storage adapter for testing.
   * @returns {{ get(key: string): unknown, set(key: string, value: unknown): void, delete(key: string): void, list(): string[] }}
   */
  function memoryStorage() {
    const data = new Map()
    return {
      get(key) { return data.get(key) },
      set(key, value) { data.set(key, value) },
      delete(key) { data.delete(key) },
      list() { return [...data.keys()] },
      _data: data,
    }
  }

  class PersistentSlot extends Slot {
    #storage
    #key
    #loaded = false

    constructor({ storage, key, value, reduce } = {}) {
      super({ value, reduce })
      if (!storage) throw new Error('storage required')
      if (!key) throw new Error('key required')
      this.#storage = storage
      this.#key = key
    }

    #load() {
      if (this.#loaded) return
      this.#loaded = true
      const stored = this.#storage.get(this.#key)
      if (stored !== undefined) {
        this.value = stored
      }
    }

    get() {
      this.#load()
      return super.get()
    }

    put(current) {
      this.#load()
      const prev = this.value
      const result = super.put(current)
      if (this.value !== prev) {
        this.#storage.set(this.#key, this.value)
      }
      return result
    }
  }

  class PersistentScope extends Scope {
    #storage
    #prefix
    #loaded = false
    #unsubs = new Map()

    constructor({ storage, prefix = '', lookup, list } = {}) {
      super({ lookup, list })
      if (!storage) throw new Error('storage required')
      this.#storage = storage
      this.#prefix = prefix
    }

    #storageKey(name) {
      return this.#prefix ? `${this.#prefix}/${name}` : name
    }

    #load() {
      if (this.#loaded) return
      this.#loaded = true
      const keys = this.#storage.list()
        .filter(k => {
          if (k.includes('::')) return false
          if (!this.#prefix) return !k.includes('/')
          return k.startsWith(this.#prefix + '/') &&
            !k.slice(this.#prefix.length + 1).includes('/')
        })

      for (const fullKey of keys) {
        const name = this.#prefix ? fullKey.slice(this.#prefix.length + 1) : fullKey
        const entry = this.#storage.get(fullKey)
        if (!entry || typeof entry !== 'object') continue

        let child
        if (entry.type === 'scope') {
          child = platform.create.PersistentScope({
            storage: this.#storage,
            prefix: fullKey,
          })
        } else if (entry.type === 'slot') {
          child = platform.create.PersistentSlot({
            storage: this.#storage,
            key: fullKey + '::value',
            value: entry.value,
          })
          if (this.#storage.get(fullKey + '::value') === undefined) {
            this.#storage.set(fullKey + '::value', entry.value)
          }
        } else {
          continue
        }

        super.put(child, { at: name })
      }
    }

    get(msg = {}) {
      this.#load()
      return super.get(msg)
    }

    put(body, headers = {}) {
      this.#load()
      const { at, meta } = headers

      // Mounting a resource function
      if (typeof body === 'function' && at != null) {
        const key = this.#storageKey(at)
        const mirror = platform.reflect(body)
        if (mirror?.isScope()) {
          this.#storage.set(key, { type: 'scope' })
        } else if (mirror?.isWritable()) {
          const value = body({})
          this.#storage.set(key, { type: 'slot', value })
          this.#storage.set(key + '::value', value)
        }

        // Clean up previous listener for this name
        if (this.#unsubs.has(at)) {
          this.#unsubs.get(at)()
        }

        // Listen for changes to persist them
        const unsub = platform.on('resource.changed', e => {
          if (e.resource === body[Symbol.for('bassline.resource')]) {
            this.#storage.set(key + '::value', e.current)
          }
        })
        this.#unsubs.set(at, unsub)

        return super.put(body, headers)
      }

      // Removing a child
      if (body === null && at != null) {
        const key = this.#storageKey(at)
        this.#storage.delete(key)
        this.#storage.delete(key + '::value')
        if (this.#unsubs.has(at)) {
          this.#unsubs.get(at)()
          this.#unsubs.delete(at)
        }
        return super.put(body, headers)
      }

      // Tree expansion or other puts
      return super.put(body, headers)
    }
  }

  platform.define({ PersistentSlot, PersistentScope })
  platform.memoryStorage = memoryStorage
}
