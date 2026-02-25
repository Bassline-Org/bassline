import utils from './utils.js'

class Resource {
  platform = null
  get utils() {
    return this?.platform?.utils
  }
  accept(aVisitor) {
    return aVisitor.visitResource(this)
  }
  announce(type, data = {}) {
    return this.platform.announce(`resource.${type}`, { resource: this, ...data })
  }
  dispatch(msg) {
    const { hasKeys, maybeThen } = this.utils;
    const onFired = (result) => {
      this.announce('fired', { msg, result })
      return result;
    }
    if (hasKeys(msg, 'put')) {
      const { put, ...rest } = msg
      return maybeThen(this.put(put, rest), onFired)
    } else {
      return maybeThen(this.get(msg), onFired)
    }
  }
  get(_msg) {
    throw new Error('Cannot get')
  }
  put(_body, _headers) {
    throw new Error('Cannot put')
  }
  static forPlatform(platform) {
    return class extends this {
      platform = platform
    }
  }
}

function topoSort(scripts, satisfiedTags) {
  // Build tag → [scripts] map
  const providers = new Map()
  for (const fn of scripts) {
    for (const tag of fn.tags ?? []) {
      if (!providers.has(tag)) providers.set(tag, [])
      providers.get(tag).push(fn)
    }
  }

  const visited = new Set()
  const visiting = new Set()
  const sorted = []

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
  _root = null
  _deployed = new Set()
  _tags = new Set()
  createHandler = {
    get(target, prop, _receiver) {
      if (Reflect.has(target.classes, prop)) {
        const aClass = Reflect.get(target.classes, prop)
        return (init) => target.resource(new aClass(init))
      }
      return Reflect.get(target.classes, prop)
    },
  }
  create = new Proxy(this, this.createHandler)
  define(classes = {}) {
    for (const [name, Class] of Object.entries(classes)) {
      this.classes[name] = Class
    }
    return this;
  }
  resource(aResource) {
    const resourceFn = aResource.dispatch.bind(aResource)
    resourceFn._resource = aResource;
    this.announce('resource.created', { resource: resourceFn })
    return resourceFn
  }
  announce(topic, message) {
    this.eventTarget?.dispatchEvent?.(new CustomEvent(topic, { detail: message }))
    return this
  }
  on(aTopic, aCallback, opts) {
    const cb = e => aCallback(e.detail, e)
    this.eventTarget?.addEventListener?.(aTopic, cb, opts)
    return () => this?.eventTarget?.removeEventListener?.(aTopic, cb)
  }
  once(aTopic, aCallback) {
    const unsub = this.on(aTopic, e => {
      const res = aCallback(e)
      unsub()
      return res
    })
    return this
  }
  get root() {
    if (!this._root) this._root = this.create.Scope()
    return this._root
  }
  use(...modules) {
    for (const mod of modules) mod(this)
    return this
  }
  async deploy(...scripts) {
    const sorted = topoSort(scripts, this._tags)
    for (const fn of sorted) {
      // Always register tags — the capability is declared regardless of skip/dedup
      for (const tag of fn.tags ?? []) this._tags.add(tag)
      if (fn.id && this._deployed.has(fn.id)) continue
      if (await fn.skip?.(this)) continue
      await fn(this)
      if (fn.id) this._deployed.add(fn.id)
    }
    return this
  }
}

export const platform = () => new Platform()

export default platform