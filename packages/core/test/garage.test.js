import { describe, it, expect } from 'vitest'
import { Platform, kResource } from '../src/kernel/platform.js'
import { reducers, scope } from '../src/resources/index.js'
import garage from '../src/infra/garage.js'
import { Garage } from '../src/infra/garage.js'

function setup() {
  const p = new Platform()
  p.use(reducers, scope, garage)
  return p
}

describe('Garage', () => {
  it('is exported as a plain class', () => {
    expect(Garage).toBeDefined()
    expect(new Garage()).toBeInstanceOf(Garage)
  })

  it('is available on platform after module is loaded', () => {
    const p = setup()
    expect(p.Garage).toBe(Garage)
  })

  describe('park', () => {
    it('returns a string ticket', () => {
      const g = new Garage()
      const ticket = g.park('anything')
      expect(typeof ticket).toBe('string')
    })

    it('deduplicates by kResource identity', () => {
      const p = setup()
      const g = new Garage()
      const slot = p.create.Slot({ value: 1 })
      const t1 = g.park(slot)
      const t2 = g.park(slot)
      expect(t1).toBe(t2)
    })

    it('parks values without kResource without dedup', () => {
      const g = new Garage()
      const t1 = g.park(42)
      const t2 = g.park(42)
      expect(typeof t1).toBe('string')
      expect(t1).not.toBe(t2) // no kResource → no identity → no dedup
      expect(g.resolve(t1)).toBe(42)
    })

    it('gives different tickets to different resources', () => {
      const p = setup()
      const g = new Garage()
      const a = p.create.Slot({ value: 1 })
      const b = p.create.Slot({ value: 2 })
      expect(g.park(a)).not.toBe(g.park(b))
    })

    it('parks plain functions without dedup', () => {
      const g = new Garage()
      const fn = () => 42
      const t1 = g.park(fn)
      const t2 = g.park(fn)
      expect(t1).not.toBe(t2)
    })

    it('parks any value type', () => {
      const g = new Garage()
      expect(typeof g.park('hello')).toBe('string')
      expect(typeof g.park(null)).toBe('string')
      expect(typeof g.park({ x: 1 })).toBe('string')
      expect(typeof g.park([1, 2, 3])).toBe('string')
    })
  })

  describe('resolve', () => {
    it('resolves a ticket to the parked value', () => {
      const g = new Garage()
      const obj = { data: 42 }
      const ticket = g.park(obj)
      expect(g.resolve(ticket)).toBe(obj)
    })

    it('resolves a reference to the parked value', () => {
      const g = new Garage()
      const obj = { data: 42 }
      const ticket = g.park(obj)
      const ref = g.mint(ticket)
      expect(g.resolve(ref)).toBe(obj)
    })

    it('throws for invalid token', () => {
      const g = new Garage()
      expect(() => g.resolve('bogus')).toThrow('invalid token')
    })
  })

  describe('has', () => {
    it('returns true for valid ticket', () => {
      const g = new Garage()
      const ticket = g.park('value')
      expect(g.has(ticket)).toBe(true)
    })

    it('returns true for valid ref', () => {
      const g = new Garage()
      const ticket = g.park('value')
      const ref = g.mint(ticket)
      expect(g.has(ref)).toBe(true)
    })

    it('returns false for unknown token', () => {
      const g = new Garage()
      expect(g.has('nonexistent')).toBe(false)
    })

    it('returns false after redeem', () => {
      const g = new Garage()
      const ticket = g.park('value')
      g.redeem(ticket)
      expect(g.has(ticket)).toBe(false)
    })
  })

  describe('mint', () => {
    it('creates a ref from a ticket', () => {
      const g = new Garage()
      const ticket = g.park('value')
      const ref = g.mint(ticket)
      expect(typeof ref).toBe('string')
      expect(ref).not.toBe(ticket)
    })

    it('throws for invalid ticket', () => {
      const g = new Garage()
      expect(() => g.mint('bogus')).toThrow('invalid ticket')
    })

    it('multiple refs all resolve to same value', () => {
      const g = new Garage()
      const obj = { data: 1 }
      const ticket = g.park(obj)
      const r1 = g.mint(ticket)
      const r2 = g.mint(ticket)
      const r3 = g.mint(ticket)
      expect(g.resolve(r1)).toBe(obj)
      expect(g.resolve(r2)).toBe(obj)
      expect(g.resolve(r3)).toBe(obj)
    })
  })

  describe('redeem', () => {
    it('returns the parked value', () => {
      const g = new Garage()
      const obj = { data: 1 }
      const ticket = g.park(obj)
      expect(g.redeem(ticket)).toBe(obj)
    })

    it('invalidates ticket and all refs', () => {
      const g = new Garage()
      const ticket = g.park('value')
      const r1 = g.mint(ticket)
      const r2 = g.mint(ticket)

      g.redeem(ticket)
      expect(g.has(ticket)).toBe(false)
      expect(g.has(r1)).toBe(false)
      expect(g.has(r2)).toBe(false)
    })

    it('cleans identity map so re-parking gives a fresh ticket', () => {
      const p = setup()
      const g = new Garage()
      const slot = p.create.Slot({ value: 1 })
      const t1 = g.park(slot)
      g.redeem(t1)
      const t2 = g.park(slot)
      expect(t2).not.toBe(t1)
    })

    it('rejects reference tokens', () => {
      const g = new Garage()
      const ticket = g.park('value')
      const ref = g.mint(ticket)
      expect(() => g.redeem(ref)).toThrow('cannot redeem a reference token')
    })

    it('throws for invalid ticket', () => {
      const g = new Garage()
      expect(() => g.redeem('bogus')).toThrow('invalid ticket')
    })

    it('park-redeem-park cycle works', () => {
      const p = setup()
      const g = new Garage()
      const slot = p.create.Slot({ value: 1 })

      const t1 = g.park(slot)
      const val = g.redeem(t1)
      expect(val).toBe(slot)

      const t2 = g.park(slot)
      expect(t2).not.toBe(t1)
      expect(g.resolve(t2)).toBe(slot)
    })
  })

  describe('with mirrors', () => {
    it('p.reflect(fn).accept(visitor) dispatches correctly', () => {
      const p = setup()
      const slot = p.create.Slot({ value: 1 })
      const sc = p.create.Scope()

      const visitor = {
        visitScope() { return 'scope' },
        visitResource() { return 'resource' },
      }

      expect(p.reflect(sc).accept(visitor)).toBe('scope')
      expect(p.reflect(slot).accept(visitor)).toBe('resource')
    })
  })
})
