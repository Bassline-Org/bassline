import { kResource } from '../kernel/connect.js'
import { Slot, SlotGrammar } from './reducers.js'
import { Scope, ExtendedScopeGrammar } from './scope.js'

/**
 * In-memory storage adapter for testing.
 * @returns {{ get(key: string): unknown, set(key: string, value: unknown): void, delete(key: string): void, list(): string[] }}
 */
export function memoryStorage() {
  const data = new Map()
  return {
    get(key) { return data.get(key) },
    set(key, value) { data.set(key, value) },
    delete(key) { data.delete(key) },
    list() { return [...data.keys()] },
    _data: data,
  }
}

/**
 * PersistentSlot — Slot backed by a storage adapter.
 * Lazy loads on first read, persists on every write.
 */
export class PersistentSlot extends Slot {
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

  read() {
    this.#load()
    return super.read()
  }

  write(current) {
    this.#load()
    const prev = this.value
    const result = super.write(current)
    if (this.value !== prev) {
      this.#storage.set(this.#key, this.value)
    }
    return result
  }
}

/**
 * PersistentScope — Scope backed by a storage adapter.
 * Persists child structure and restores from storage.
 */
export class PersistentScope extends Scope {
  #storage
  #prefix
  #loaded = false
  #unsubs = new Map()
  #platform = null

  constructor({ storage, prefix = '', lookup, list } = {}) {
    super({ lookup, list })
    if (!storage) throw new Error('storage required')
    this.#storage = storage
    this.#prefix = prefix
  }

  /** Set platform reference — called by the module after creation */
  _setPlatform(platform) {
    this.#platform = platform
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
        child = this.#platform.create.PersistentScope({
          storage: this.#storage,
          prefix: fullKey,
        })
      } else if (entry.type === 'slot') {
        child = this.#platform.create.PersistentSlot({
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

      // Mount directly in the scope backend
      super.mount(name, child)
    }
  }

  resolve(name) {
    this.#load()
    return super.resolve(name)
  }

  list() {
    this.#load()
    return super.list()
  }

  has(name) {
    this.#load()
    return super.has(name)
  }

  meta(name) {
    this.#load()
    return super.meta(name)
  }

  mount(name, body, meta) {
    this.#load()
    const key = this.#storageKey(name)
    const mirror = this.#platform?.reflect(body)
    if (mirror?.isScope()) {
      this.#storage.set(key, { type: 'scope' })
    } else if (mirror?.isWritable()) {
      const value = body({})
      this.#storage.set(key, { type: 'slot', value })
      this.#storage.set(key + '::value', value)
    }

    // Clean up previous listener for this name
    if (this.#unsubs.has(name)) {
      this.#unsubs.get(name)()
    }

    // Listen for changes to persist them
    const unsub = this.#platform?.on('resource.changed', e => {
      if (e.resource === body[kResource]) {
        this.#storage.set(key + '::value', e.current)
      }
    })
    if (unsub) this.#unsubs.set(name, unsub)

    super.mount(name, body, meta)
  }

  unmount(name) {
    this.#load()
    const key = this.#storageKey(name)
    this.#storage.delete(key)
    this.#storage.delete(key + '::value')
    if (this.#unsubs.has(name)) {
      this.#unsubs.get(name)()
      this.#unsubs.delete(name)
    }
    super.unmount(name)
  }
}

/**
 * Module function — registers PersistentSlot and PersistentScope on the platform.
 * @param {import('../types').Platform} platform
 */
export default function persistence(platform) {
  const slotGrammar = p => new SlotGrammar(p.events)
  const scopeGrammar = p => new ExtendedScopeGrammar(
    p.events,
    () => p.create.Scope(),
    thing => p.reflect(thing),
  )

  platform.define(
    { PersistentSlot, PersistentScope },
    { PersistentSlot: slotGrammar, PersistentScope: scopeGrammar },
  )

  // Override create for PersistentScope to inject platform reference
  const origHandler = platform.createHandler
  platform.createHandler = {
    get(target, prop, receiver) {
      if (prop === 'PersistentScope' && target.classes.PersistentScope) {
        return init => {
          const impl = new PersistentScope(init)
          impl._setPlatform(target)
          const grammarSpec = target.grammars.PersistentScope
          const g = typeof grammarSpec === 'function' ? grammarSpec(target) : grammarSpec
          const { connect } = await_connect()
          const fn = connect(g, impl)
          target.announce('resource.created', { resource: fn })
          if (impl._pendingEntries) {
            const entries = impl._pendingEntries
            delete impl._pendingEntries
            fn({ put: entries })
          }
          return fn
        }
      }
      return origHandler.get(target, prop, receiver)
    },
  }
  platform.create = new Proxy(platform, platform.createHandler)

  platform.memoryStorage = memoryStorage
}

// Top-level import
import { connect } from '../kernel/connect.js'
function await_connect() { return { connect } }
