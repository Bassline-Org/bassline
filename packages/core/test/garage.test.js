import { describe, it, expect } from 'vitest'
import { Platform } from '../src/platform.js'
import { reducers, scope, garage } from '../src/modules/index.js'

function setup() {
  const p = new Platform()
  p.use(reducers, scope, garage)
  return p
}

describe('Garage', () => {
  describe('park', () => {
    it('returns a string ticket', () => {
      const p = setup()
      const g = new p.Garage()
      const slot = p.create.Slot({ value: 1 })
      const ticket = g.park(slot)
      expect(typeof ticket).toBe('string')
    })

    it('deduplicates by resource identity', () => {
      const p = setup()
      const g = new p.Garage()
      const slot = p.create.Slot({ value: 1 })
      const t1 = g.park(slot)
      const t2 = g.park(slot)
      expect(t1).toBe(t2)
    })

    it('rejects non-functions', () => {
      const p = setup()
      const g = new p.Garage()
      expect(() => g.park(42)).toThrow('can only park functions')
      expect(() => g.park('hello')).toThrow('can only park functions')
      expect(() => g.park(null)).toThrow('can only park functions')
    })

    it('gives different tickets to different resources', () => {
      const p = setup()
      const g = new p.Garage()
      const a = p.create.Slot({ value: 1 })
      const b = p.create.Slot({ value: 2 })
      expect(g.park(a)).not.toBe(g.park(b))
    })

    it('parks plain functions (no kResource) without dedup', () => {
      const p = setup()
      const g = new p.Garage()
      const fn = () => 42
      const t1 = g.park(fn)
      const t2 = g.park(fn)
      expect(t1).not.toBe(t2)
    })
  })

  describe('resolve', () => {
    it('resolves a ticket to the original function', () => {
      const p = setup()
      const g = new p.Garage()
      const slot = p.create.Slot({ value: 1 })
      const ticket = g.park(slot)
      expect(g.resolve(ticket)).toBe(slot)
    })

    it('resolves a reference to the original function', () => {
      const p = setup()
      const g = new p.Garage()
      const slot = p.create.Slot({ value: 1 })
      const ticket = g.park(slot)
      const ref = g.mint(ticket)
      expect(g.resolve(ref)).toBe(slot)
    })

    it('throws for invalid token', () => {
      const p = setup()
      const g = new p.Garage()
      expect(() => g.resolve('bogus')).toThrow('invalid token')
    })
  })

  describe('has', () => {
    it('returns true for valid ticket', () => {
      const p = setup()
      const g = new p.Garage()
      const ticket = g.park(p.create.Slot({ value: 1 }))
      expect(g.has(ticket)).toBe(true)
    })

    it('returns true for valid ref', () => {
      const p = setup()
      const g = new p.Garage()
      const ticket = g.park(p.create.Slot({ value: 1 }))
      const ref = g.mint(ticket)
      expect(g.has(ref)).toBe(true)
    })

    it('returns false for unknown token', () => {
      const p = setup()
      const g = new p.Garage()
      expect(g.has('nonexistent')).toBe(false)
    })

    it('returns false after redeem', () => {
      const p = setup()
      const g = new p.Garage()
      const ticket = g.park(p.create.Slot({ value: 1 }))
      g.redeem(ticket)
      expect(g.has(ticket)).toBe(false)
    })
  })

  describe('mint', () => {
    it('creates a ref from a ticket', () => {
      const p = setup()
      const g = new p.Garage()
      const ticket = g.park(p.create.Slot({ value: 1 }))
      const ref = g.mint(ticket)
      expect(typeof ref).toBe('string')
      expect(ref).not.toBe(ticket)
    })

    it('throws for invalid ticket', () => {
      const p = setup()
      const g = new p.Garage()
      expect(() => g.mint('bogus')).toThrow('invalid ticket')
    })

    it('multiple refs all resolve to same function', () => {
      const p = setup()
      const g = new p.Garage()
      const slot = p.create.Slot({ value: 1 })
      const ticket = g.park(slot)
      const r1 = g.mint(ticket)
      const r2 = g.mint(ticket)
      const r3 = g.mint(ticket)
      expect(g.resolve(r1)).toBe(slot)
      expect(g.resolve(r2)).toBe(slot)
      expect(g.resolve(r3)).toBe(slot)
    })
  })

  describe('redeem', () => {
    it('returns the original function', () => {
      const p = setup()
      const g = new p.Garage()
      const slot = p.create.Slot({ value: 1 })
      const ticket = g.park(slot)
      expect(g.redeem(ticket)).toBe(slot)
    })

    it('invalidates ticket and all refs', () => {
      const p = setup()
      const g = new p.Garage()
      const slot = p.create.Slot({ value: 1 })
      const ticket = g.park(slot)
      const r1 = g.mint(ticket)
      const r2 = g.mint(ticket)

      g.redeem(ticket)
      expect(g.has(ticket)).toBe(false)
      expect(g.has(r1)).toBe(false)
      expect(g.has(r2)).toBe(false)
    })

    it('cleans dedup map so re-parking gives a fresh ticket', () => {
      const p = setup()
      const g = new p.Garage()
      const slot = p.create.Slot({ value: 1 })
      const t1 = g.park(slot)
      g.redeem(t1)
      const t2 = g.park(slot)
      expect(t2).not.toBe(t1)
    })

    it('rejects reference tokens', () => {
      const p = setup()
      const g = new p.Garage()
      const ticket = g.park(p.create.Slot({ value: 1 }))
      const ref = g.mint(ticket)
      expect(() => g.redeem(ref)).toThrow('cannot redeem a reference token')
    })

    it('throws for invalid ticket', () => {
      const p = setup()
      const g = new p.Garage()
      expect(() => g.redeem('bogus')).toThrow('invalid ticket')
    })

    it('park-redeem-park cycle works', () => {
      const p = setup()
      const g = new p.Garage()
      const slot = p.create.Slot({ value: 1 })

      const t1 = g.park(slot)
      const fn = g.redeem(t1)
      expect(fn).toBe(slot)

      const t2 = g.park(slot)
      expect(t2).not.toBe(t1)
      expect(g.resolve(t2)).toBe(slot)
    })
  })

  describe('visitor via reflect', () => {
    it('p.reflect(fn).accept(visitor) dispatches correctly', () => {
      const p = setup()
      const slot = p.create.Slot({ value: 1 })
      const scope = p.create.Scope()

      const visitor = {
        visitScope() {
          return 'scope'
        },
        visitSlot() {
          return 'slot'
        },
        visitResource() {
          return 'resource'
        },
      }

      expect(p.reflect(scope).accept(visitor)).toBe('scope')
      expect(p.reflect(slot).accept(visitor)).toBe('resource')
    })
  })
})
