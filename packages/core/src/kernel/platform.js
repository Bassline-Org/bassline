import utils from './utils.js'
import { kResource, connect } from './connect.js'
import { EventBusGrammar, EventBus } from '../resources/eventbus.js'

export { kResource } from './connect.js'
export { connect } from './connect.js'

/** @typedef {import('../types').ResourceFn} ResourceFn */
/** @typedef {import('../types').DeployScript} DeployScript */
/** @typedef {import('../types').Module} Module */

/**
 * Topological sort of deploy scripts by tags/dependencies.
 * @param {DeployScript[]} scripts
 * @param {Set<string>} satisfiedTags
 * @returns {DeployScript[]}
 */
function topoSort(scripts, satisfiedTags) {
  /** @type {Map<string, DeployScript[]>} */
  const providers = new Map()
  for (const fn of scripts) {
    for (const tag of fn.tags ?? []) {
      if (!providers.has(tag)) providers.set(tag, [])
      providers.get(tag).push(fn)
    }
  }

  const visited = new Set()
  const visiting = new Set()
  /** @type {DeployScript[]} */
  const sorted = []

  /** @param {DeployScript} fn */
  function visit(fn) {
    if (visited.has(fn)) return
    if (visiting.has(fn)) throw new Error('circular dependency')
    visiting.add(fn)
    for (const dep of fn.dependencies ?? []) {
      if (satisfiedTags.has(dep)) continue
      const deps = providers.get(dep)
      if (!deps) throw new Error(`missing dependency: ${dep}`)
      for (const d of deps) visit(d)
    }
    visiting.delete(fn)
    visited.add(fn)
    sorted.push(fn)
  }

  for (const fn of scripts) visit(fn)
  return sorted
}

/**
 * ResourceMirror — reflective interface for a backend instance.
 */
export class ResourceMirror {
  #impl

  constructor(impl) {
    this[kResource] = impl
    this.#impl = impl
  }

  getClass() {
    return this.#impl.constructor
  }

  /**
   * @param {Platform} platform
   * @returns {boolean}
   */
  isScope(platform) {
    if (this._platform) platform = this._platform
    const ScopeClass = platform?.classes?.Scope
    return ScopeClass ? this.#impl instanceof ScopeClass : false
  }

  /**
   * @param {Platform} platform
   * @returns {boolean}
   */
  isWritable(platform) {
    if (this._platform) platform = this._platform
    const SlotClass = platform?.classes?.Slot
    return SlotClass ? this.#impl instanceof SlotClass : false
  }

  accept(visitor) {
    if (this.#impl.accept) return this.#impl.accept(visitor)
    return visitor.visitResource?.(this.#impl)
  }
}

/**
 * Backward-compatible Resource base class.
 * Allows `class Foo extends Resource { get() {} put() {} }` patterns
 * in tests and user code. dispatch() creates a resource function.
 */
export class Resource {
  platform = null;

  [kResource] = this

  get utils() {
    return this?.platform?.utils
  }

  accept(visitor) {
    return visitor.visitResource(this)
  }

  dispatch(msg) {
    if (msg && 'put' in msg) {
      const { put, ...rest } = msg
      return this.put(put, rest)
    }
    return this.get(msg)
  }

  get(_msg) {
    throw new Error('Cannot get')
  }

  put(_body, _headers) {
    throw new Error('Cannot put')
  }
}

export class Platform {
  utils = utils
  classes = { Resource }
  grammars = {}

  /** @type {ResourceFn | null} */
  _root = null

  /** @type {Set<string>} */
  _deployed = new Set()

  /** @type {Set<string>} */
  _tags = new Set()

  #events
  #mirrors = new WeakMap()

  constructor() {
    this.#events = connect(new EventBusGrammar(), new EventBus())
  }

  /**
   * The pub/sub event bus resource.
   * @returns {ResourceFn}
   */
  get events() {
    return this.#events
  }

  /**
   * Get a mirror for a resource or resource function.
   * @param {unknown} thing
   * @returns {ResourceMirror | null}
   */
  reflect(thing) {
    const impl = thing?.[kResource]
    if (!impl) return null
    if (!this.#mirrors.has(impl)) {
      const mirror = new ResourceMirror(impl)
      mirror._platform = this
      this.#mirrors.set(impl, mirror)
    }
    return this.#mirrors.get(impl)
  }

  createHandler = {
    get(target, prop, _receiver) {
      if (Reflect.has(target.classes, prop)) {
        const aClass = Reflect.get(target.classes, prop)
        const grammar = target.grammars[prop]
        return init => {
          const impl = new aClass(init)
          const g = typeof grammar === 'function' ? grammar(target) : grammar
          const fn = connect(g, impl)
          target.announce('resource.created', { resource: fn })
          // Handle pending entries (Scope constructor with entries option)
          if (impl._pendingEntries) {
            const entries = impl._pendingEntries
            delete impl._pendingEntries
            fn({ put: entries })
          }
          return fn
        }
      }
      return Reflect.get(target.classes, prop)
    },
  }

  /** @type {Record<string, (init?: unknown) => ResourceFn>} */
  create = new Proxy(this, this.createHandler)

  /**
   * Register resource classes and their grammars on the platform.
   * @param {Record<string, Function>} [classes]
   * @param {Record<string, import('./grammar.js').Grammar>} [grammars]
   * @returns {this}
   */
  define(classes = {}, grammars = {}) {
    for (const [name, Class] of Object.entries(classes)) {
      this.classes[name] = Class
    }
    for (const [name, grammar] of Object.entries(grammars)) {
      this.grammars[name] = grammar
    }
    return this
  }

  /**
   * Wire a grammar to a backend, producing a resource function.
   * Convenience method — delegates to connect().
   * @param {import('./grammar.js').Grammar} grammar
   * @param {object} impl
   * @returns {ResourceFn}
   */
  connect(grammar, impl) {
    const fn = connect(grammar, impl)
    this.announce('resource.created', { resource: fn })
    return fn
  }

  /**
   * Backward-compatible: wrap a backend into a resource function using its registered grammar.
   * Also accepts old Resource-style objects with a dispatch() method.
   * @param {object} aResource
   * @returns {ResourceFn}
   */
  resource(aResource) {
    // Old-style Resource with dispatch() method
    if (typeof aResource.dispatch === 'function') {
      if (aResource instanceof Resource) aResource.platform = this
      const resourceFn = aResource.dispatch.bind(aResource)
      resourceFn[kResource] = aResource
      this.announce('resource.created', { resource: resourceFn })
      return resourceFn
    }
    // New-style: find registered grammar for this class
    for (const [name, Class] of Object.entries(this.classes)) {
      if (aResource instanceof Class && this.grammars[name]) {
        const g = this.grammars[name]
        const grammar = typeof g === 'function' ? g(this) : g
        return this.connect(grammar, aResource)
      }
    }
    throw new Error('no grammar registered for this resource type')
  }

  /**
   * Emit a platform event.
   * @param {string} topic
   * @param {Record<string, unknown>} [data]
   * @returns {this}
   */
  announce(topic, data = {}) {
    this.#events({ put: { type: topic, ...data } })
    return this
  }

  /**
   * Subscribe to a platform event. Returns an unsubscribe function.
   * @param {string} aTopic
   * @param {(detail: unknown) => void} aCallback
   * @returns {() => void}
   */
  on(aTopic, aCallback) {
    return this.#events({ subscribe: aTopic, callback: aCallback })
  }

  /**
   * Subscribe to a platform event, firing only once.
   * @param {string} aTopic
   * @param {(detail: unknown) => unknown} aCallback
   * @returns {this}
   */
  once(aTopic, aCallback) {
    const unsub = this.on(aTopic, data => {
      unsub()
      aCallback(data)
    })
    return this
  }

  /** @returns {ResourceFn} */
  get root() {
    if (!this._root) this._root = this.create.Scope()
    return this._root
  }

  /**
   * Register modules that extend the platform.
   * @param {...Module} modules
   * @returns {this}
   */
  use(...modules) {
    for (const mod of modules) mod(this)
    return this
  }

  /**
   * Deploy scripts into the platform. Topologically sorted by tags/dependencies.
   * @param {...DeployScript} scripts
   * @returns {Promise<this>}
   */
  async deploy(...scripts) {
    const sorted = topoSort(scripts, this._tags)
    for (const fn of sorted) {
      for (const tag of fn.tags ?? []) this._tags.add(tag)
      if (fn.id && this._deployed.has(fn.id)) continue
      if (await fn.skip?.(this)) continue
      await fn(this)
      if (fn.id) this._deployed.add(fn.id)
    }
    return this
  }
}

/** @returns {Platform} */
export const platform = () => new Platform()

export default platform
