export default function (platform) {
  const {
    classes: { Resource },
    utils: { isPlainObject }
  } = platform

  /**
   * Scope — composite resource that maps names to child resources.
   *
   * @param {Object} [options]
   * @param {Object} [options.entries] - Initial tree of children (plain objects expand recursively)
   * @param {function} [options.lookup] - Dynamic child resolution: `(name) => resourceFn | null`
   * @param {function} [options.list] - Dynamic name listing: `() => string[]`
   *
   * ## Get protocol
   *
   *   {}                  → list child names (string[])
   *   { name }            → resolve child by name (resourceFn)
   *   { walk: 'a/b/c' }  → resolve path through nested scopes (resourceFn)
   *   { has: name }       → check if name exists (boolean)
   *   { meta: name }      → retrieve metadata for name (object | null)
   *
   * Name resolution: static entries (from put) take precedence over dynamic lookup.
   * Walk peels one segment per scope and delegates { walk: rest } to the child.
   *
   * ## Put protocol
   *
   *   { put: fn, name }            → mount resource function at name
   *   { put: fn, name, meta }      → mount with metadata
   *   { put: null, name }          → remove child at name
   *   { put: { key: fn, ... } }    → expand plain object tree into nested scopes
   *   { put: ..., prefix: 'a/b' }  → auto-create intermediate scopes, then mount
   *
   * Tree expansion is recursive and merge-safe: putting { cells: { tags } }
   * into a scope that already has cells: Scope(counter, title) adds tags
   * alongside existing children.
   *
   * ## Events (via platform.on)
   *
   *   'resource.mounted'    → { resource, name, child }  — child mounted at name
   *   'resource.unmounted'  → { resource, name }         — child removed from name
   *   'resource.fired'      → { resource, msg, result }  — any dispatch (inherited)
   */
  class Scope extends Resource {
    #entries = new Map()
    #metadata = new Map()
    #customLookup = null
    #customList = null

    constructor({ entries, lookup, list } = {}) {
      super()
      this.#customLookup = lookup ?? null
      this.#customList = list ?? null
      if (entries) {
        for (const [key, value] of Object.entries(entries)) {
          this.put(value, { name: key })
        }
      }
    }

    get({ name, walk, has, meta } = {}) {
      // Walk: resolve a path through nested scopes
      if (walk !== undefined) {
        const { maybeThen } = this.utils
        const segments = typeof walk === 'string' ? walk.split('/').filter(Boolean) : walk
        if (segments.length === 0) return this.get({ name })
        const [first, ...rest] = segments
        return maybeThen(this.get({ name: first }), child => {
          if (rest.length === 0) return child
          if (typeof child !== 'function')
            throw new Error(`walk: '${first}' is not a resource`)
          return child({ walk: rest })
        })
      }
      // Has: check existence
      if (has !== undefined) {
        if (this.#entries.has(has)) return true
        if (this.#customLookup) return this.#customLookup(has) != null
        return false
      }
      // Meta: retrieve metadata
      if (meta !== undefined) {
        return this.#metadata.get(meta) ?? null
      }
      if (name !== undefined) {
        const entry = this.#entries.get(name)
        if (entry != null) return entry
        if (this.#customLookup) {
          const custom = this.#customLookup(name)
          if (custom != null) return custom
        }
        throw new Error(`not found: ${name}`)
      }
      const names = new Set(this.#entries.keys())
      if (this.#customList) {
        for (const n of this.#customList()) names.add(n)
      }
      return [...names]
    }

    put(body, { name, prefix, meta } = {}) {
      if (prefix) {
        const segments = prefix.split('/').filter(Boolean)
        if (segments.length > 0) {
          const [first, ...rest] = segments
          let child = this.#entries.get(first)
          if (child == null) {
            child = this.platform.create.Scope()
            this.#entries.set(first, child)
            this.announce('mounted', { name: first, child })
          }
          const msg = { put: body }
          if (rest.length > 0) msg.prefix = rest.join('/')
          if (name != null) msg.name = name
          return child(msg)
        }
      }

      // Remove: null body deletes a child
      if (body === null) {
        if (name == null) throw new Error('name required for remove')
        this.#entries.delete(name)
        this.#metadata.delete(name)
        this.announce('unmounted', { name })
        return
      }

      if (typeof body === 'function') {
        if (name == null) throw new Error('name required')
        this.#entries.set(name, body)
        if (meta != null) this.#metadata.set(name, meta)
        this.announce('mounted', { name, child: body })
        return body
      }

      if (isPlainObject(body)) {
        if (name != null) {
          let child = this.#entries.get(name)
          if (child == null || !(child._resource instanceof Scope)) {
            child = this.platform.create.Scope()
            this.#entries.set(name, child)
            this.announce('mounted', { name, child })
          }
          return child({ put: body })
        }
        for (const [key, value] of Object.entries(body)) {
          this.put(value, { name: key })
        }
        return
      }

      throw new Error('put body must be a resource function or plain object tree')
    }

    accept(aVisitor) {
      return aVisitor.visitScope?.(this) ?? super.accept(aVisitor)
    }
  }

  platform.define({ Scope })
}
