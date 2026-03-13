import { message } from '../kernel/grammar.js'

export const list = message({})
export const resolve = message({ selector: 'at:' })
export const walk = message({ selector: 'walk:' })
export const has = message({ selector: 'has:' })
export const meta = message({ selector: 'meta:' })

export const mount = message({ selector: 'at:put:', guard: ({ put: body }) => body != null })
export const unmount = message({ selector: 'at:put:', guard: ({ put: body }) => body == null })
/**
 * @param {} impl
 * @param {*} msg
 * @returns
 */
export function dispatch(impl, msg) {
  // puts
  if (mount.match(msg)) return impl.mount(msg.at, msg.put, msg.meta)
  if (unmount.match(msg)) return impl.unmount(msg.at)

  // gets
  if (meta.match(msg)) return impl.meta(msg.meta)
  if (has.match(msg)) return impl.has(msg.has)
  if (walk.match(msg)) return impl.walk(msg.walk)
  if (resolve.match(msg)) return impl.resolve(msg.at)
  if (list.match(msg)) return impl.list()
  return impl.dnu(msg)
}

/**
 * Scope backend — maps names to child resources.
 *
 * Algebra:
 *   resolve(name)        → child
 *   list()               → names[]
 *   mount(name, child)   → void
 *   unmount(name)        → void
 *   has(name)            → boolean
 *   meta(name)           → metadata | null
 */
export class Scope {
  /** @type {Map<string, import('../types').ResourceFn>} */
  #entries = new Map()

  /** @type {Map<string, Record<string, unknown>>} */
  #metadata = new Map()

  /** @type {((name: string) => import('../types').ResourceFn | null) | null} */
  #customLookup = null

  /** @type {(() => string[]) | null} */
  #customList = null

  constructor({ entries, lookup, list } = {}) {
    this.#customLookup = lookup ?? null
    this.#customList = list ?? null
    // entries are handled after connect() via _pendingEntries
    // because we need the resource function (grammar) to expand trees
    if (entries) this._pendingEntries = entries
  }

  /**
   * @param {string} name
   * @returns {import('../types').ResourceFn}
   */
  resolve(name) {
    const entry = this.#entries.get(name)
    if (entry != null) return entry
    if (this.#customLookup) {
      const custom = this.#customLookup(name)
      if (custom != null) return custom
    }
    throw new Error(`not found: ${name}`)
  }

  /** @returns {string[]} */
  list() {
    const names = new Set(this.#entries.keys())
    if (this.#customList) {
      for (const n of this.#customList()) names.add(n)
    }
    return [...names]
  }

  /**
   * @param {string} name
   * @param {import('../types').ResourceFn} child
   * @param {Record<string, unknown>} [meta]
   */
  mount(name, child, meta) {
    this.#entries.set(name, child)
    if (meta != null) this.#metadata.set(name, meta)
  }

  /** @param {string} name */
  unmount(name) {
    this.#entries.delete(name)
    this.#metadata.delete(name)
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    if (this.#entries.has(name)) return true
    if (this.#customLookup) return this.#customLookup(name) != null
    return false
  }

  /**
   * @param {string} name
   * @returns {Record<string, unknown> | null}
   */
  meta(name) {
    return this.#metadata.get(name) ?? null
  }

  accept(visitor) {
    return visitor.visitScope?.(this) ?? visitor.visitResource?.(this)
  }
}

/**
 * Module function — registers Scope on the platform.
 * @param {import('../types').Platform} platform
 */
export default function (platform) {
  const scopeGrammar = p =>
    new ExtendedScopeGrammar(
      p.events,
      () => p.create.Scope(),
      thing => p.reflect(thing)
    )

  platform.define({ Scope }, { Scope: scopeGrammar })
}
