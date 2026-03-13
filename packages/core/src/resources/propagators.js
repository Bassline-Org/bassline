import { Grammar } from '../kernel/grammar.js'
import { kResource, connect } from '../kernel/connect.js'
import { Scope, ScopeGrammar } from './scope.js'

/**
 * PropagatorGrammar — extends ScopeGrammar with propagator-specific messages.
 *
 * Enforces fixed keyspace on put/at operations.
 * Adds fire message recognition.
 */
class PropagatorGrammar extends ScopeGrammar {
  dispatch(msg, impl) {
    if ('fire' in msg) {
      impl.fire()
      return
    }
    if ('put' in msg) return this.dispatchPropagatorWrite(msg, impl)
    return this.dispatchPropagatorRead(msg, impl)
  }

  dispatchPropagatorRead(msg, impl) {
    if ('walk' in msg) return this.walk(msg.walk, impl)
    if ('meta' in msg) return impl.meta(msg.meta)
    if ('has' in msg) {
      if (!impl.keys.has(msg.has)) return false
      return impl.has(msg.has)
    }
    if ('at' in msg) {
      if (!impl.keys.has(msg.at)) throw new Error(`unknown key: ${msg.at}`)
      return impl.resolve(msg.at)
    }
    // Empty get — return keys and bound hrefs
    const hrefs = impl.list()
    return { hrefs, keys: [...impl.keys] }
  }

  dispatchPropagatorWrite(msg, impl) {
    const { put, at } = msg
    if (at == null) throw new Error('at required')
    if (!impl.keys.has(at)) throw new Error(`unknown key: ${at}`)
    if (put !== null && typeof put !== 'function') {
      throw new Error('propagator cells must be resource functions or null')
    }
    if (put === null) {
      impl.unbindCell(at)
    } else {
      impl.bindCell(at, put, msg.meta)
    }
  }
}

/**
 * Propagator backend — reactive computation over a fixed keyspace.
 *
 * Extends Scope for cell storage. Watches for resource.changed events
 * and re-executes body when inputs change.
 */
export class Propagator extends Scope {
  /** @type {Set<string>} */
  #keys

  #scheduled = false

  /** @type {Map<string, object>} */
  #watched = new Map()

  /** @type {(() => void) | null} */
  #unsub = null

  /** @type {object} platform reference, set by module */
  platform = null

  /** @type {Function} events resource, set by module */
  _events = null

  constructor({ cells = {}, body } = {}) {
    super()
    this.#keys = new Set(Object.keys(cells))
    if (body) this.body = body
  }

  get keys() {
    return this.#keys
  }

  /**
   * Initialize cells — called after connect by the module.
   * @param {Record<string, unknown>} cells
   */
  _initCells(cells) {
    for (const [name, value] of Object.entries(cells)) {
      if (value != null) this.bindCell(name, value)
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
    this._events?.({ put: { type: 'resource.error', resource: this, error } })
  }

  /**
   * @param {Record<string, import('../types').ResourceFn | null>} cells
   * @returns {boolean}
   */
  shouldActivate(cells) {
    return Object.values(cells).every(v => v != null)
  }

  /**
   * Schedule execution. Override for custom scheduling.
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
   * Build bindings and call body.
   */
  execute() {
    if (this.#keys.size === 0) return
    const bindings = {}
    for (const key of this.#keys) {
      bindings[key] = this.has(key) ? this.resolve(key) : null
    }
    if (!this.shouldActivate(bindings)) return
    try {
      this.body(bindings)
      this._events?.({ put: { type: 'resource.propagated', resource: this } })
    } catch (error) {
      this.onError(error)
    }
  }

  fire() {
    this.run()
  }

  /**
   * Bind a resource to a cell name.
   */
  bindCell(name, value, meta) {
    this.#watched.delete(name)
    this.mount(name, value, meta)
    this._events?.({ put: { type: 'resource.mounted', resource: this, name, child: value } })

    if (value[kResource]) {
      this.#watched.set(name, value[kResource])
      this.#ensureListener()
    }

    this.run()
  }

  /**
   * Unbind a cell.
   */
  unbindCell(name) {
    this.#watched.delete(name)
    if (this.has(name)) {
      this.unmount(name)
    }
    if (this.#watched.size === 0 && this.#unsub) {
      this.#unsub()
      this.#unsub = null
    }
    this.run()
  }

  #ensureListener() {
    if (this.#unsub) return
    this.#unsub = this._events?.({
      subscribe: 'resource.changed',
      callback: data => {
        for (const resource of this.#watched.values()) {
          if (resource === data.resource) {
            this.run()
            return
          }
        }
      },
    })
  }

  accept(visitor) {
    return visitor.visitPropagator?.(this) ?? visitor.visitScope?.(this) ?? visitor.visitResource?.(this)
  }
}

/**
 * Module function — registers Propagator on the platform.
 * @param {import('../types').Platform} platform
 */
export default function (platform) {
  const propagatorGrammar = p => new PropagatorGrammar(p.events)

  platform.define(
    { Propagator },
    { Propagator: propagatorGrammar },
  )

  // Override the create proxy to handle Propagator subclasses
  const origHandler = platform.createHandler
  platform.createHandler = {
    get(target, prop, receiver) {
      const aClass = target.classes[prop]
      if (aClass && (aClass === Propagator || aClass.prototype instanceof Propagator)) {
        return init => {
          const impl = new aClass(init)
          impl.platform = target
          impl._events = target.events
          const grammarSpec = target.grammars.Propagator
          const g = typeof grammarSpec === 'function' ? grammarSpec(target) : grammarSpec
          const fn = connect(g, impl)
          target.announce('resource.created', { resource: fn })
          if (init?.cells) impl._initCells(init.cells)
          return fn
        }
      }
      return origHandler.get(target, prop, receiver)
    },
  }
  platform.create = new Proxy(platform, platform.createHandler)
}
