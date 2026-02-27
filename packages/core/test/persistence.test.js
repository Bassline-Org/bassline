import { describe, it, expect } from 'vitest'
import { Platform } from '../src/platform.js'
import { reducers, scope } from '../src/modules/index.js'
import persistence from '../src/modules/persistence.js'

function setup() {
  const p = new Platform()
  p.use(reducers, scope, persistence)
  return p
}

describe('Persistence', () => {
  describe('memoryStorage', () => {
    it('provides a basic key-value store', () => {
      const p = setup()
      const store = p.memoryStorage()
      store.set('a', 1)
      store.set('b', 2)
      expect(store.get('a')).toBe(1)
      expect(store.get('b')).toBe(2)
      expect(store.list()).toEqual(['a', 'b'])
      store.delete('a')
      expect(store.get('a')).toBe(undefined)
      expect(store.list()).toEqual(['b'])
    })
  })

  describe('PersistentSlot', () => {
    it('saves value on put', () => {
      const p = setup()
      const store = p.memoryStorage()
      const slot = p.create.PersistentSlot({ storage: store, key: 'counter' })
      slot({ put: 42 })
      expect(store.get('counter')).toBe(42)
    })

    it('loads saved value on first get', () => {
      const p = setup()
      const store = p.memoryStorage()
      store.set('counter', 99)
      const slot = p.create.PersistentSlot({ storage: store, key: 'counter', value: 0 })
      expect(slot({})).toBe(99)
    })

    it('uses initial value when storage is empty', () => {
      const p = setup()
      const store = p.memoryStorage()
      const slot = p.create.PersistentSlot({ storage: store, key: 'counter', value: 7 })
      expect(slot({})).toBe(7)
    })

    it('persists across put cycles', () => {
      const p = setup()
      const store = p.memoryStorage()
      const slot = p.create.PersistentSlot({ storage: store, key: 'x' })
      slot({ put: 1 })
      slot({ put: 2 })
      slot({ put: 3 })
      expect(store.get('x')).toBe(3)
      expect(slot({})).toBe(3)
    })

    it('works with a reducer', () => {
      const p = setup()
      const store = p.memoryStorage()
      const slot = p.create.PersistentSlot({
        storage: store,
        key: 'max',
        value: 0,
        reduce: Math.max,
      })
      slot({ put: 5 })
      slot({ put: 3 })
      slot({ put: 10 })
      expect(store.get('max')).toBe(10)
      expect(slot({})).toBe(10)
    })

    it('lazy load only happens once', () => {
      const p = setup()
      const store = p.memoryStorage()
      store.set('x', 100)
      const slot = p.create.PersistentSlot({ storage: store, key: 'x', value: 0 })

      // First get loads from storage
      expect(slot({})).toBe(100)

      // Mutate storage directly — should NOT affect the slot (already loaded)
      store.set('x', 999)
      expect(slot({})).toBe(100)
    })

    it('skips storage write when value unchanged (reducer)', () => {
      const p = setup()
      const store = p.memoryStorage()
      const slot = p.create.PersistentSlot({
        storage: store,
        key: 'max',
        value: 10,
        reduce: Math.max,
      })
      slot({ put: 5 }) // 5 < 10, no change
      // Storage should not have been written (value didn't change)
      expect(store.get('max')).toBe(undefined) // never changed from initial
    })

    it('throws without storage', () => {
      const p = setup()
      expect(() => p.create.PersistentSlot({ key: 'x' })).toThrow('storage required')
    })

    it('throws without key', () => {
      const p = setup()
      const store = p.memoryStorage()
      expect(() => p.create.PersistentSlot({ storage: store })).toThrow('key required')
    })
  })

  describe('PersistentScope', () => {
    it('persists mounted children', () => {
      const p = setup()
      const store = p.memoryStorage()
      const root = p.create.PersistentScope({ storage: store })

      root({ put: p.create.Slot({ value: 42 }), at: 'counter' })
      expect(store.get('counter')).toEqual({ type: 'slot', value: 42 })
    })

    it('persists scope children', () => {
      const p = setup()
      const store = p.memoryStorage()
      const root = p.create.PersistentScope({ storage: store })

      root({ put: p.create.Scope(), at: 'sub' })
      expect(store.get('sub')).toEqual({ type: 'scope' })
    })

    it('removes from storage on delete', () => {
      const p = setup()
      const store = p.memoryStorage()
      const root = p.create.PersistentScope({ storage: store })

      root({ put: p.create.Slot({ value: 1 }), at: 'x' })
      expect(store.get('x')).toBeDefined()

      root({ put: null, at: 'x' })
      expect(store.get('x')).toBe(undefined)
    })

    it('restores slot children from storage', () => {
      const p = setup()
      const store = p.memoryStorage()

      // Simulate previously persisted state
      store.set('counter', { type: 'slot', value: 42 })
      store.set('counter::value', 42)

      const root = p.create.PersistentScope({ storage: store })
      const counter = root({ at: 'counter' })
      expect(counter({})).toBe(42)
    })

    it('restores nested scopes from storage', () => {
      const p = setup()
      const store = p.memoryStorage()

      // Simulate previously persisted state
      store.set('cells', { type: 'scope' })
      store.set('cells/counter', { type: 'slot', value: 7 })
      store.set('cells/counter::value', 7)

      const root = p.create.PersistentScope({ storage: store })
      const cells = root({ at: 'cells' })
      const counter = cells({ at: 'counter' })
      expect(counter({})).toBe(7)
    })

    it('persists slot value changes via events', async () => {
      const p = setup()
      const store = p.memoryStorage()
      const root = p.create.PersistentScope({ storage: store })

      const slot = p.create.Slot({ value: 0 })
      root({ put: slot, at: 'x' })
      expect(store.get('x::value')).toBe(0)

      // Write through the slot
      slot({ put: 42 })
      expect(store.get('x::value')).toBe(42)
    })

    it('lists children from storage', () => {
      const p = setup()
      const store = p.memoryStorage()

      store.set('a', { type: 'slot', value: 1 })
      store.set('a::value', 1)
      store.set('b', { type: 'slot', value: 2 })
      store.set('b::value', 2)

      const root = p.create.PersistentScope({ storage: store })
      const listing = root({})
      expect(listing.hrefs.sort()).toEqual(['a', 'b'])
    })

    it('walk works through persistent scopes', () => {
      const p = setup()
      const store = p.memoryStorage()

      store.set('deep', { type: 'scope' })
      store.set('deep/nested', { type: 'scope' })
      store.set('deep/nested/val', { type: 'slot', value: 'found' })
      store.set('deep/nested/val::value', 'found')

      const root = p.create.PersistentScope({ storage: store })
      const val = root({ walk: 'deep/nested/val' })
      expect(val({})).toBe('found')
    })

    it('cleans up event listener on remove', () => {
      const p = setup()
      const store = p.memoryStorage()
      const root = p.create.PersistentScope({ storage: store })

      const slot = p.create.Slot({ value: 0 })
      root({ put: slot, at: 'x' })
      slot({ put: 10 })
      expect(store.get('x::value')).toBe(10)

      // Remove the child
      root({ put: null, at: 'x' })

      // Further changes should NOT persist (listener was cleaned up)
      slot({ put: 99 })
      expect(store.get('x::value')).toBe(undefined) // key was deleted on remove
    })

    it('replaces listener when remounting at same name', () => {
      const p = setup()
      const store = p.memoryStorage()
      const root = p.create.PersistentScope({ storage: store })

      const slot1 = p.create.Slot({ value: 1 })
      root({ put: slot1, at: 'x' })

      const slot2 = p.create.Slot({ value: 2 })
      root({ put: slot2, at: 'x' })

      // Old slot changes should not persist
      slot1({ put: 100 })
      // New slot changes should persist
      slot2({ put: 200 })
      expect(store.get('x::value')).toBe(200)
    })

    it('throws without storage', () => {
      const p = setup()
      expect(() => p.create.PersistentScope({})).toThrow('storage required')
    })

    it('prefix correctly scopes storage keys', () => {
      const p = setup()
      const store = p.memoryStorage()
      const sub = p.create.PersistentScope({ storage: store, prefix: 'app' })

      sub({ put: p.create.Slot({ value: 1 }), at: 'x' })
      expect(store.get('app/x')).toEqual({ type: 'slot', value: 1 })
      expect(store.get('app/x::value')).toBe(1)
    })
  })
})
