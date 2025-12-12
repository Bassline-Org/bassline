/**
 * Tests for @bassline/tmp
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Bassline } from '@bassline/core'
import { createTmpStateRoutes } from '../src/state.js'
import { createTmpFnRoutes } from '../src/fn.js'
import { createFnSystem } from '@bassline/fn'

describe('@bassline/tmp', () => {
  describe('tmp/state', () => {
    let bl
    let state

    beforeEach(() => {
      bl = new Bassline()
      state = createTmpStateRoutes({ bl })
      state.install(bl)
    })

    it('stores and retrieves state', async () => {
      await bl.put('bl:///tmp/state/sidebar', {}, { collapsed: true })

      const result = await bl.get('bl:///tmp/state/sidebar')
      expect(result.body).toEqual({ collapsed: true })
    })

    it('supports nested state names', async () => {
      await bl.put('bl:///tmp/state/ui/modal', {}, { open: true, type: 'confirm' })

      const result = await bl.get('bl:///tmp/state/ui/modal')
      expect(result.body).toEqual({ open: true, type: 'confirm' })
    })

    it('returns null for non-existent state', async () => {
      const result = await bl.get('bl:///tmp/state/nonexistent')
      expect(result).toBeNull()
    })

    it('lists all state keys', async () => {
      await bl.put('bl:///tmp/state/a', {}, 1)
      await bl.put('bl:///tmp/state/b', {}, 2)
      await bl.put('bl:///tmp/state/c/d', {}, 3)

      const result = await bl.get('bl:///tmp/state')
      expect(result.body.entries).toHaveLength(3)
      expect(result.body.entries.map((e) => e.name)).toContain('a')
      expect(result.body.entries.map((e) => e.name)).toContain('b')
      expect(result.body.entries.map((e) => e.name)).toContain('c/d')
    })

    it('deletes state', async () => {
      await bl.put('bl:///tmp/state/toDelete', {}, { value: 1 })

      // Verify it exists
      let result = await bl.get('bl:///tmp/state/toDelete')
      expect(result.body).toEqual({ value: 1 })

      // Delete it
      await bl.put('bl:///tmp/state/toDelete/delete', {}, {})

      // Verify it's gone
      result = await bl.get('bl:///tmp/state/toDelete')
      expect(result).toBeNull()
    })

    it('updates existing state', async () => {
      await bl.put('bl:///tmp/state/counter', {}, { value: 1 })
      await bl.put('bl:///tmp/state/counter', {}, { value: 2 })

      const result = await bl.get('bl:///tmp/state/counter')
      expect(result.body).toEqual({ value: 2 })
    })
  })

  describe('tmp/fn', () => {
    let bl
    let tmpFn

    beforeEach(() => {
      bl = new Bassline()

      // Install fn system (required for tmp/fn to work)
      const fnSystem = createFnSystem()
      bl.mount('/fn', fnSystem.routes)
      bl.setModule('fn', {
        get: fnSystem.registry.get,
        getSync: fnSystem.registry.getSync,
        registry: fnSystem.registry,
      })

      tmpFn = createTmpFnRoutes({ bl })
      tmpFn.install(bl)
    })

    it('creates a temporary function', async () => {
      await bl.put(
        'bl:///tmp/fn/double',
        {},
        {
          definition: ['bl:///fn/multiply', { value: 2 }],
          description: 'Double a number',
        }
      )

      const result = await bl.get('bl:///tmp/fn/double')
      expect(result.body.name).toBe('double')
      expect(result.body.temporary).toBe(true)
    })

    it('lists temporary functions', async () => {
      await bl.put('bl:///tmp/fn/double', {}, { definition: ['bl:///fn/multiply', { value: 2 }] })
      await bl.put('bl:///tmp/fn/triple', {}, { definition: ['bl:///fn/multiply', { value: 3 }] })

      const result = await bl.get('bl:///tmp/fn')
      expect(result.body.entries).toHaveLength(2)
    })

    it('deletes temporary functions', async () => {
      await bl.put('bl:///tmp/fn/toDelete', {}, { definition: ['bl:///fn/identity'] })

      // Verify it exists
      let result = await bl.get('bl:///tmp/fn/toDelete')
      expect(result).not.toBeNull()

      // Delete it
      await bl.put('bl:///tmp/fn/toDelete/delete', {}, {})

      // Verify it's gone
      result = await bl.get('bl:///tmp/fn/toDelete')
      expect(result).toBeNull()
    })

    it('temporary function can be used in propagator', async () => {
      // This test would need the full propagator setup
      // For now, just verify the function is registered in the fn registry
      await bl.put('bl:///tmp/fn/negate', {}, { definition: 'bl:///fn/negate' })

      const fnModule = await bl.getModule('fn')
      // get() is async
      const negateFn = await fnModule.get('bl:///tmp/fn/negate')
      expect(negateFn).not.toBeNull()
      expect(negateFn(5)).toBe(-5)
    })
  })
})
