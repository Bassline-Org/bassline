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
   *   {}                  → list child names ({ hrefs: string[] })
   *   { at }              → resolve child by name (resourceFn)
   *   { walk: 'a/b/c' }  → resolve path through nested scopes (resourceFn)
   *   { has: name }       → check if name exists (boolean)
   *   { meta: name }      → retrieve metadata for name (object | null)
   *
   * Name resolution: static entries (from put) take precedence over dynamic lookup.
   * Walk peels one segment per scope and delegates { walk: rest } to the child.
   *
   * ## Put protocol
   *
   *   { put: fn, at }            → mount resource function at name
   *   { put: fn, at, meta }      → mount with metadata
   *   { put: null, at }          → remove child at name
   *   { put: { key: fn, ... } }  → expand plain object tree into nested scopes
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
          this.put(value, { at: key })
        }
      }
    }

    get({ at, walk, has, meta } = {}) {
      // Walk: resolve a path through nested scopes
      if (walk !== undefined) {
        const { maybeThen } = this.utils
        const segments = typeof walk === 'string' ? walk.split('/').filter(Boolean) : walk
        if (segments.length === 0) return this.get({ at })
        const [first, ...rest] = segments
        return maybeThen(this.get({ at: first }), child => {
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
      if (at !== undefined) {
        const entry = this.#entries.get(at)
        if (entry != null) return entry
        if (this.#customLookup) {
          const custom = this.#customLookup(at)
          if (custom != null) return custom
        }
        throw new Error(`not found: ${at}`)
      }
      const names = new Set(this.#entries.keys())
      if (this.#customList) {
        for (const n of this.#customList()) names.add(n)
      }
      return { hrefs: [...names] }
    }

    put(body, { at, prefix, meta } = {}) {
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
          if (at != null) msg.at = at
          return child(msg)
        }
      }

      // Remove: null body deletes a child
      if (body === null) {
        if (at == null) throw new Error('at required for remove')
        this.#entries.delete(at)
        this.#metadata.delete(at)
        this.announce('unmounted', { name: at })
        return
      }

      if (typeof body === 'function') {
        if (at == null) throw new Error('at required')
        this.#entries.set(at, body)
        if (meta != null) this.#metadata.set(at, meta)
        this.announce('mounted', { name: at, child: body })
        return body
      }

      if (isPlainObject(body)) {
        if (at != null) {
          let child = this.#entries.get(at)
          if (child == null || !(child._resource instanceof Scope)) {
            child = this.platform.create.Scope()
            this.#entries.set(at, child)
            this.announce('mounted', { name: at, child })
          }
          return child({ put: body })
        }
        for (const [key, value] of Object.entries(body)) {
          this.put(value, { at: key })
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
