import utils from './utils.js'

/** @typedef {import('./types').ResourceFn} ResourceFn */
/** @typedef {import('./types').DeployScript} DeployScript */
/** @typedef {import('./types').Module} Module */

export class Resource {
  /** @type {Platform} */
  platform = null

  get utils() {
    return this?.platform?.utils
  }

  /**
   * @param {Record<string, (r: Resource) => unknown>} aVisitor
   * @returns {unknown}
   */
  accept(aVisitor) {
    return aVisitor.visitResource(this)
  }

  /**
   * @param {string} type
   * @param {Record<string, unknown>} [data]
   */
  announce(type, data = {}) {
    return this.platform.announce(`resource.${type}`, { resource: this, ...data })
  }

  /**
   * @param {unknown} msg
   * @returns {unknown}
   */
  dispatch(msg) {
    const { hasKeys, maybeThen } = this.utils
    const onFired = result => {
      this.announce('fired', { msg, result })
      return result
    }
    if (hasKeys(msg, 'put')) {
      const { put, ...rest } = msg
      return maybeThen(this.put(put, rest), onFired)
    } else {
      return maybeThen(this.get(msg), onFired)
    }
  }

  /** @param {unknown} _msg */
  get(_msg) {
    throw new Error('Cannot get')
  }

  /**
   * @param {unknown} _body
   * @param {unknown} _headers
   */
  put(_body, _headers) {
    throw new Error('Cannot put')
  }

  /**
   * @param {Platform} platform
   * @returns {typeof Resource}
   */
  static forPlatform(platform) {
    return class extends this {
      platform = platform
    }
  }
}

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

export class Platform {
  eventTarget = new EventTarget()
  utils = utils
  classes = { Resource: Resource.forPlatform(this) }

  /** @type {ResourceFn | null} */
  _root = null

  /** @type {Set<string>} */
  _deployed = new Set()

  /** @type {Set<string>} */
  _tags = new Set()

  createHandler = {
    get(target, prop, _receiver) {
      if (Reflect.has(target.classes, prop)) {
        const aClass = Reflect.get(target.classes, prop)
        return init => target.resource(new aClass(init))
      }
      return Reflect.get(target.classes, prop)
    },
  }

  /** @type {Record<string, (init?: unknown) => ResourceFn>} */
  create = new Proxy(this, this.createHandler)

  /**
   * Register resource classes on the platform.
   * @param {Record<string, typeof Resource>} [classes]
   * @returns {this}
   */
  define(classes = {}) {
    for (const [name, Class] of Object.entries(classes)) {
      this.classes[name] = Class
    }
    return this
  }

  /**
   * Wrap a Resource instance into a callable resource function.
   * @param {Resource} aResource
   * @returns {ResourceFn}
   */
  resource(aResource) {
    const resourceFn = aResource.dispatch.bind(aResource)
    resourceFn._resource = aResource
    this.announce('resource.created', { resource: resourceFn })
    return resourceFn
  }

  /**
   * Emit a platform event.
   * @param {string} topic
   * @param {Record<string, unknown>} [message]
   * @returns {this}
   */
  announce(topic, message) {
    this.eventTarget?.dispatchEvent?.(new CustomEvent(topic, { detail: message }))
    return this
  }

  /**
   * Subscribe to a platform event. Returns an unsubscribe function.
   * @param {string} aTopic
   * @param {(detail: unknown) => void} aCallback
   * @param {AddEventListenerOptions} [opts]
   * @returns {() => void}
   */
  on(aTopic, aCallback, opts) {
    const cb = e => aCallback(e.detail, e)
    this.eventTarget?.addEventListener?.(aTopic, cb, opts)
    return () => this?.eventTarget?.removeEventListener?.(aTopic, cb)
  }

  /**
   * Subscribe to a platform event, firing only once.
   * @param {string} aTopic
   * @param {(detail: unknown) => unknown} aCallback
   * @returns {this}
   */
  once(aTopic, aCallback) {
    const unsub = this.on(aTopic, e => {
      const res = aCallback(e)
      unsub()
      return res
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
