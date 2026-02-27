import { describe, it, expect } from 'vitest'
import { Platform } from '../src/platform.js'
import { reducers, scope } from '../src/modules/index.js'
import gate from '../src/modules/gate.js'

function setup() {
  const p = new Platform()
  p.use(reducers, scope, gate)
  return p
}

describe('GatedScope', () => {
  describe('declarative capabilities', () => {
    it('allows reads when get: true', () => {
      const p = setup()
      const inner = p.create.Scope()
      inner({ put: p.create.Slot({ value: 42 }), at: 'x' })

      const gated = p.create.GatedScope({ target: inner, capabilities: { get: true } })
      const x = gated({ at: 'x' })
      expect(x({})).toBe(42)
    })

    it('denies reads when get: false', () => {
      const p = setup()
      const inner = p.create.Scope()
      inner({ put: p.create.Slot({ value: 42 }), at: 'x' })

      const gated = p.create.GatedScope({ target: inner, capabilities: { get: false } })
      expect(() => gated({ at: 'x' })).toThrow('read denied')
    })

    it('allows writes when put: true', () => {
      const p = setup()
      const slot = p.create.Slot({ value: 0 })
      const inner = p.create.Scope()
      inner({ put: slot, at: 'x' })

      const gated = p.create.GatedScope({ target: inner, capabilities: { put: true, get: true } })
      gated({ put: p.create.Slot({ value: 99 }), at: 'y' })
      expect(inner({ has: 'y' })).toBe(true)
    })

    it('denies writes when put: false', () => {
      const p = setup()
      const inner = p.create.Scope()

      const gated = p.create.GatedScope({ target: inner, capabilities: { get: true, put: false } })
      expect(() => gated({ put: p.create.Slot({ value: 1 }), at: 'x' })).toThrow('write denied')
    })

    it('restricts walk to allowed names', () => {
      const p = setup()
      const inner = p.create.Scope()
      inner({ put: p.create.Slot({ value: 1 }), at: 'allowed' })
      inner({ put: p.create.Slot({ value: 2 }), at: 'secret' })

      const gated = p.create.GatedScope({
        target: inner,
        capabilities: { get: true, walk: ['allowed'] },
      })

      expect(gated({ at: 'allowed' })({})).toBe(1)
      expect(() => gated({ at: 'secret' })).toThrow('access denied: secret')
    })

    it('allows listing even with walk restrictions', () => {
      const p = setup()
      const inner = p.create.Scope()
      inner({ put: p.create.Slot({ value: 1 }), at: 'a' })
      inner({ put: p.create.Slot({ value: 2 }), at: 'b' })

      const gated = p.create.GatedScope({
        target: inner,
        capabilities: { get: true, walk: ['a'] },
      })

      // Listing doesn't have an at/walk key, so walk restriction doesn't apply
      const listing = gated({})
      expect(listing).toEqual({ hrefs: ['a', 'b'] })
    })

    it('restricts walk paths by first segment', () => {
      const p = setup()
      const inner = p.create.Scope()
      inner({
        put: {
          cells: { counter: p.create.Slot({ value: 0 }) },
          config: { debug: p.create.Slot({ value: false }) },
        },
      })

      const gated = p.create.GatedScope({
        target: inner,
        capabilities: { get: true, walk: ['cells'] },
      })

      const counter = gated({ walk: 'cells/counter' })
      expect(counter({})).toBe(0)
      expect(() => gated({ walk: 'config/debug' })).toThrow('access denied: config')
    })

    it('has check works through gate', () => {
      const p = setup()
      const inner = p.create.Scope()
      inner({ put: p.create.Slot({ value: 1 }), at: 'x' })

      const gated = p.create.GatedScope({
        target: inner,
        capabilities: { get: true },
      })

      expect(gated({ has: 'x' })).toBe(true)
      expect(gated({ has: 'nope' })).toBe(false)
    })

    it('has is restricted by walk', () => {
      const p = setup()
      const inner = p.create.Scope()
      inner({ put: p.create.Slot({ value: 1 }), at: 'allowed' })
      inner({ put: p.create.Slot({ value: 2 }), at: 'secret' })

      const gated = p.create.GatedScope({
        target: inner,
        capabilities: { get: true, walk: ['allowed'] },
      })

      expect(gated({ has: 'allowed' })).toBe(true)
      expect(() => gated({ has: 'secret' })).toThrow('access denied: secret')
    })

    it('meta check works through gate', () => {
      const p = setup()
      const inner = p.create.Scope()
      inner({ put: p.create.Slot({ value: 1 }), at: 'x', meta: { size: 100 } })

      const gated = p.create.GatedScope({
        target: inner,
        capabilities: { get: true },
      })

      expect(gated({ meta: 'x' })).toEqual({ size: 100 })
    })

    it('meta is restricted by walk', () => {
      const p = setup()
      const inner = p.create.Scope()
      inner({ put: p.create.Slot({ value: 1 }), at: 'allowed', meta: { a: 1 } })
      inner({ put: p.create.Slot({ value: 2 }), at: 'secret', meta: { b: 2 } })

      const gated = p.create.GatedScope({
        target: inner,
        capabilities: { get: true, walk: ['allowed'] },
      })

      expect(gated({ meta: 'allowed' })).toEqual({ a: 1 })
      expect(() => gated({ meta: 'secret' })).toThrow('access denied: secret')
    })

    it('write with at is restricted by walk', () => {
      const p = setup()
      const inner = p.create.Scope()

      const gated = p.create.GatedScope({
        target: inner,
        capabilities: { get: true, put: true, walk: ['allowed'] },
      })

      gated({ put: p.create.Slot({ value: 1 }), at: 'allowed' })
      expect(inner({ has: 'allowed' })).toBe(true)
      expect(() => gated({ put: p.create.Slot({ value: 2 }), at: 'secret' })).toThrow('access denied: secret')
    })
  })

  describe('function-based check', () => {
    it('allows when check returns true', () => {
      const p = setup()
      const inner = p.create.Scope()
      inner({ put: p.create.Slot({ value: 42 }), at: 'x' })

      const gated = p.create.GatedScope({
        target: inner,
        check: () => true,
      })

      expect(gated({ at: 'x' })({})).toBe(42)
    })

    it('denies when check returns false', () => {
      const p = setup()
      const inner = p.create.Scope()
      inner({ put: p.create.Slot({ value: 42 }), at: 'x' })

      const gated = p.create.GatedScope({
        target: inner,
        check: () => false,
      })

      expect(() => gated({ at: 'x' })).toThrow('access denied')
    })

    it('denies when check throws', () => {
      const p = setup()
      const inner = p.create.Scope()
      inner({ put: p.create.Slot({ value: 42 }), at: 'x' })

      const gated = p.create.GatedScope({
        target: inner,
        check: () => { throw new Error('nope') },
      })

      expect(() => gated({ at: 'x' })).toThrow('nope')
    })

    it('receives the full message for custom logic', () => {
      const p = setup()
      const inner = p.create.Scope()
      inner({ put: p.create.Slot({ value: 1 }), at: 'public' })
      inner({ put: p.create.Slot({ value: 2 }), at: 'private' })

      const gated = p.create.GatedScope({
        target: inner,
        check: msg => {
          if (msg.at === 'private') throw new Error('forbidden')
          return true
        },
      })

      expect(gated({ at: 'public' })({})).toBe(1)
      expect(() => gated({ at: 'private' })).toThrow('forbidden')
    })

    it('check receives write messages', () => {
      const p = setup()
      const inner = p.create.Scope()
      const msgs = []

      const gated = p.create.GatedScope({
        target: inner,
        check: msg => { msgs.push(msg); return true },
      })

      const slot = p.create.Slot({ value: 1 })
      gated({ put: slot, at: 'x' })
      expect(msgs).toEqual([{ put: slot, at: 'x' }])
    })
  })

  describe('edge cases', () => {
    it('throws without target', () => {
      const p = setup()
      expect(() => p.create.GatedScope({})).toThrow('target required')
    })

    it('no capabilities means allow everything', () => {
      const p = setup()
      const inner = p.create.Scope()
      inner({ put: p.create.Slot({ value: 1 }), at: 'x' })

      const gated = p.create.GatedScope({ target: inner })
      expect(gated({ at: 'x' })({})).toBe(1)
      gated({ put: p.create.Slot({ value: 2 }), at: 'y' })
      expect(inner({ at: 'y' })({})).toBe(2)
    })

    it('is a scope (reflects correctly)', () => {
      const p = setup()
      const inner = p.create.Scope()
      const gated = p.create.GatedScope({ target: inner })
      expect(p.reflect(gated).isScope()).toBe(true)
    })

    it('read-only gate: get true, put false', () => {
      const p = setup()
      const inner = p.create.Scope()
      inner({ put: p.create.Slot({ value: 'readable' }), at: 'data' })

      const gated = p.create.GatedScope({
        target: inner,
        capabilities: { get: true, put: false },
      })

      expect(gated({ at: 'data' })({})).toBe('readable')
      expect(gated({})).toEqual({ hrefs: ['data'] })
      expect(() => gated({ put: p.create.Slot({ value: 1 }), at: 'new' })).toThrow('write denied')
    })
  })
})
