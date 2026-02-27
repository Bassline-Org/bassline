import { describe, it, expect } from 'vitest'
import { Platform } from '../src/platform.js'
import { reducers, scope } from '../src/modules/index.js'

function setup() {
  const p = new Platform()
  reducers(p)
  scope(p)
  return p
}

describe('Scope', () => {
  describe('single resource mount', () => {
    it('mounts a resource function by name', () => {
      const p = setup()
      const root = p.create.Scope()
      const counter = p.create.Slot({ value: 0 })
      root({ put: counter, at: 'counter' })
      expect(root({ at: 'counter' })).toBe(counter)
    })

    it('throws when mounting a function without a name', () => {
      const p = setup()
      const root = p.create.Scope()
      const counter = p.create.Slot({ value: 0 })
      expect(() => root({ put: counter })).toThrow('at required')
    })

    it('lists mounted names', () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 0 }), at: 'a' })
      root({ put: p.create.Slot({ value: 0 }), at: 'b' })
      expect(root({})).toEqual({ hrefs: ['a', 'b'] })
    })

    it('throws on get of non-existent name', () => {
      const p = setup()
      const root = p.create.Scope()
      expect(() => root({ at: 'missing' })).toThrow('not found')
    })
  })

  describe('tree mount', () => {
    it('expands a plain object into nested scopes', () => {
      const p = setup()
      const root = p.create.Scope()
      const counter = p.create.Slot({ value: 0 })
      const title = p.create.Slot({ value: 'hello' })

      root({ put: { cells: { counter, title } } })

      const cells = root({ at: 'cells' })
      expect(typeof cells).toBe('function')
      expect(cells({})).toEqual({ hrefs: ['counter', 'title'] })

      const gotCounter = cells({ at: 'counter' })
      expect(gotCounter).toBe(counter)
      expect(gotCounter({})).toBe(0)
    })

    it('handles deeply nested trees', () => {
      const p = setup()
      const root = p.create.Scope()
      const leaf = p.create.Slot({ value: 42 })

      root({ put: { a: { b: { c: leaf } } } })

      const a = root({ at: 'a' })
      const b = a({ at: 'b' })
      const c = b({ at: 'c' })
      expect(c).toBe(leaf)
      expect(c({})).toBe(42)
    })
  })

  describe('merge', () => {
    it('merges into an existing scope without overwriting', () => {
      const p = setup()
      const root = p.create.Scope()
      const counter = p.create.Slot({ value: 0 })
      const title = p.create.Slot({ value: 'hi' })
      const tags = p.create.Union()

      root({ put: { cells: { counter, title } } })
      root({ put: { cells: { tags } } })

      const cells = root({ at: 'cells' })
      expect(cells({})).toEqual({ hrefs: ['counter', 'title', 'tags'] })
      expect(cells({ at: 'counter' })).toBe(counter)
      expect(cells({ at: 'title' })).toBe(title)
      expect(cells({ at: 'tags' })).toBe(tags)
    })

    it('merges sibling branches independently', () => {
      const p = setup()
      const root = p.create.Scope()

      root({ put: { cells: { a: p.create.Slot({ value: 1 }) } } })
      root({ put: { store: { b: p.create.Slot({ value: 2 }) } } })

      expect(root({})).toEqual({ hrefs: ['cells', 'store'] })
      const cells = root({ at: 'cells' })
      expect(cells({})).toEqual({ hrefs: ['a'] })
      const store = root({ at: 'store' })
      expect(store({})).toEqual({ hrefs: ['b'] })
    })
  })

  describe('prefix', () => {
    it('auto-creates intermediate scopes from prefix', () => {
      const p = setup()
      const root = p.create.Scope()
      const leaf = p.create.Slot({ value: 'deep' })

      root({ prefix: 'a/b', put: leaf, at: 'leaf' })

      const a = root({ at: 'a' })
      const b = a({ at: 'b' })
      expect(b({ at: 'leaf' })).toBe(leaf)
      expect(leaf({})).toBe('deep')
    })

    it('prefix with tree body', () => {
      const p = setup()
      const root = p.create.Scope()
      const blocks = p.create.Slot({ value: [] })

      root({ prefix: 'services/eth', put: { blocks } })

      const services = root({ at: 'services' })
      const eth = services({ at: 'eth' })
      expect(eth({ at: 'blocks' })).toBe(blocks)
    })

    it('prefix reuses existing intermediate scopes', () => {
      const p = setup()
      const root = p.create.Scope()

      root({ prefix: 'a', put: p.create.Slot({ value: 1 }), at: 'x' })
      root({ prefix: 'a', put: p.create.Slot({ value: 2 }), at: 'y' })

      const a = root({ at: 'a' })
      expect(a({})).toEqual({ hrefs: ['x', 'y'] })
    })
  })

  describe('constructor with entries', () => {
    it('builds a tree from entries at construction time', () => {
      const p = setup()
      const root = p.create.Scope({
        entries: {
          cells: {
            counter: p.create.Slot({ value: 0, reduce: Math.max }),
            title: p.create.Slot({ value: '' }),
          },
          store: {
            config: p.create.Slot({ value: {} }),
          },
        },
      })

      expect(root({})).toEqual({ hrefs: ['cells', 'store'] })
      const cells = root({ at: 'cells' })
      expect(cells({})).toEqual({ hrefs: ['counter', 'title'] })
      const counter = cells({ at: 'counter' })
      expect(counter({})).toBe(0)
      counter({ put: 5 })
      expect(counter({})).toBe(5)
      counter({ put: 3 })
      expect(counter({})).toBe(5) // max wins
    })
  })

  describe('dynamic lookup and list', () => {
    it('lookup provides on-demand resources', () => {
      const p = setup()
      const root = p.create.Scope({
        lookup(name) {
          if (name.startsWith('block-')) {
            return p.create.Slot({ value: { id: name } })
          }
        },
        list() {
          return ['latest']
        },
      })

      const block = root({ at: 'block-123' })
      expect(typeof block).toBe('function')
      expect(block({})).toEqual({ id: 'block-123' })
    })

    it('list merges entry names with custom list', () => {
      const p = setup()
      const root = p.create.Scope({
        list() {
          return ['dynamic-a', 'dynamic-b']
        },
      })
      root({ put: p.create.Slot({ value: 1 }), at: 'static' })

      const names = root({})
      expect(names.hrefs).toContain('static')
      expect(names.hrefs).toContain('dynamic-a')
      expect(names.hrefs).toContain('dynamic-b')
    })

    it('static entries take precedence over lookup', () => {
      const p = setup()
      const staticSlot = p.create.Slot({ value: 'static' })
      const root = p.create.Scope({
        lookup() {
          return p.create.Slot({ value: 'dynamic' })
        },
      })
      root({ put: staticSlot, at: 'x' })

      expect(root({ at: 'x' })).toBe(staticSlot)
      expect(root({ at: 'x' })({})).toBe('static')
    })

    it('throws when name is not found in entries or lookup', () => {
      const p = setup()
      const root = p.create.Scope()
      expect(() => root({ at: 'nope' })).toThrow('not found')
    })
  })

  describe('visitor', () => {
    it('accepts a visitor with visitScope', () => {
      const p = setup()
      const root = p.create.Scope()
      const visited = []
      const visitor = {
        visitScope(scope) {
          visited.push(scope)
          return 'visited'
        },
      }
      expect(p.reflect(root).accept(visitor)).toBe('visited')
      expect(visited).toHaveLength(1)
    })

    it('falls back to visitResource if no visitScope', () => {
      const p = setup()
      const root = p.create.Scope()
      const visitor = {
        visitResource(_resource) {
          return 'fallback'
        },
      }
      expect(p.reflect(root).accept(visitor)).toBe('fallback')
    })
  })

  describe('remove', () => {
    it('removes a mounted entry by name', () => {
      const p = setup()
      const root = p.create.Scope()
      const slot = p.create.Slot({ value: 1 })
      root({ put: slot, at: 'x' })
      root({ put: null, at: 'x' })
      expect(() => root({ at: 'x' })).toThrow('not found')
    })

    it('listing no longer includes removed name', () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 1 }), at: 'a' })
      root({ put: p.create.Slot({ value: 2 }), at: 'b' })
      root({ put: null, at: 'a' })
      expect(root({})).toEqual({ hrefs: ['b'] })
    })

    it('fires resource.unmounted event', () => {
      const p = setup()
      const events = []
      p.on('resource.unmounted', e => events.push(e))

      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 0 }), at: 'x' })
      root({ put: null, at: 'x' })

      expect(events).toHaveLength(1)
      expect(events[0].name).toBe('x')
    })

    it('throws when removing without a name', () => {
      const p = setup()
      const root = p.create.Scope()
      expect(() => root({ put: null })).toThrow('at required for remove')
    })

    it('remove also clears metadata', () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 1 }), at: 'x', meta: { kind: 'cell' } })
      root({ put: null, at: 'x' })
      expect(root({ meta: 'x' })).toBe(null)
    })
  })

  describe('has', () => {
    it('returns true for mounted name', () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 1 }), at: 'x' })
      expect(root({ has: 'x' })).toBe(true)
    })

    it('returns false for unknown name', () => {
      const p = setup()
      const root = p.create.Scope()
      expect(root({ has: 'nope' })).toBe(false)
    })

    it('returns true for dynamically looked-up name', () => {
      const p = setup()
      const root = p.create.Scope({
        lookup(name) {
          if (name === 'dynamic') return p.create.Slot({ value: 1 })
          return null
        },
      })
      expect(root({ has: 'dynamic' })).toBe(true)
    })

    it('returns false when lookup returns null', () => {
      const p = setup()
      const root = p.create.Scope({
        lookup() {
          return null
        },
      })
      expect(root({ has: 'missing' })).toBe(false)
    })
  })

  describe('meta', () => {
    it('stores metadata on mount', () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 1 }), at: 'x', meta: { kind: 'cell' } })
      expect(root({ meta: 'x' })).toEqual({ kind: 'cell' })
    })

    it('returns null for name with no metadata', () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 1 }), at: 'x' })
      expect(root({ meta: 'x' })).toBe(null)
    })

    it('returns null for unknown name', () => {
      const p = setup()
      const root = p.create.Scope()
      expect(root({ meta: 'unknown' })).toBe(null)
    })

    it('remove clears associated metadata', () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 1 }), at: 'x', meta: { kind: 'cell' } })
      expect(root({ meta: 'x' })).toEqual({ kind: 'cell' })
      root({ put: null, at: 'x' })
      expect(root({ meta: 'x' })).toBe(null)
    })
  })

  describe('events', () => {
    it('fires mounted events', () => {
      const p = setup()
      const events = []
      p.on('resource.mounted', e => events.push(e))

      const root = p.create.Scope()
      const slot = p.create.Slot({ value: 0 })
      root({ put: slot, at: 'x' })

      expect(events).toHaveLength(1)
      expect(events[0].name).toBe('x')
      expect(events[0].child).toBe(slot)
    })

    it('fires unmounted then mounted when overwriting a function entry', () => {
      const p = setup()
      const events = []
      p.on('resource.mounted', e => events.push({ type: 'mounted', name: e.name }))
      p.on('resource.unmounted', e => events.push({ type: 'unmounted', name: e.name }))

      const root = p.create.Scope()
      const a = p.create.Slot({ value: 1 })
      const b = p.create.Slot({ value: 2 })
      root({ put: a, at: 'x' })
      root({ put: b, at: 'x' })

      expect(events).toEqual([
        { type: 'mounted', name: 'x' },
        { type: 'unmounted', name: 'x' },
        { type: 'mounted', name: 'x' },
      ])
    })

    it('fires unmounted when a non-scope is replaced by tree expansion', () => {
      const p = setup()
      const events = []
      p.on('resource.unmounted', e => events.push(e.name))

      const root = p.create.Scope()
      const slot = p.create.Slot({ value: 1 })
      root({ put: slot, at: 'x' })
      // overwrite non-scope 'x' with a plain object (creates scope)
      root({ put: { child: p.create.Slot({ value: 2 }) }, at: 'x' })

      expect(events).toContain('x')
    })
  })
})

describe('Scope walk', () => {
  it('walks a path to a leaf resource', () => {
    const p = setup()
    const counter = p.create.Slot({ value: 42 })
    const root = p.create.Scope({
      entries: {
        cells: { counter },
      },
    })

    const result = root({ walk: 'cells/counter' })
    expect(result).toBe(counter)
    expect(result({})).toBe(42)
  })

  it('walks to an intermediate scope', () => {
    const p = setup()
    const root = p.create.Scope({
      entries: {
        a: { b: { c: p.create.Slot({ value: 'leaf' }) } },
      },
    })

    const b = root({ walk: 'a/b' })
    expect(b({})).toEqual({ hrefs: ['c'] })
  })

  it('returns child names for empty path', () => {
    const p = setup()
    const root = p.create.Scope()
    root({ put: p.create.Slot({ value: 1 }), at: 'x' })
    expect(root({ walk: '' })).toEqual({ hrefs: ['x'] })
    expect(root({ walk: [] })).toEqual({ hrefs: ['x'] })
  })

  it('throws for non-existent path', () => {
    const p = setup()
    const root = p.create.Scope()
    expect(() => root({ walk: 'missing' })).toThrow()
  })

  it('accepts an array of segments', () => {
    const p = setup()
    const slot = p.create.Slot({ value: 99 })
    const root = p.create.Scope({ entries: { a: { b: slot } } })

    expect(root({ walk: ['a', 'b'] })).toBe(slot)
  })
})
