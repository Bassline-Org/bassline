import { describe, it, expect } from 'vitest'
import { createCells, lattices } from '../src/cells.js'
import { createMockKit } from './helpers.js'

describe('lattices', () => {
  describe('maxNumber', () => {
    it('returns max of two values', () => {
      expect(lattices.maxNumber.merge(5, 10)).toBe(10)
      expect(lattices.maxNumber.merge(10, 5)).toBe(10)
    })

    it('handles initial value', () => {
      expect(lattices.maxNumber.merge(lattices.maxNumber.initial, 5)).toBe(5)
    })
  })

  describe('minNumber', () => {
    it('returns min of two values', () => {
      expect(lattices.minNumber.merge(5, 10)).toBe(5)
      expect(lattices.minNumber.merge(10, 5)).toBe(5)
    })
  })

  describe('setUnion', () => {
    it('unions two arrays', () => {
      const result = lattices.setUnion.merge([1, 2], [2, 3])
      expect(result).toContain(1)
      expect(result).toContain(2)
      expect(result).toContain(3)
      expect(result.length).toBe(3)
    })
  })

  describe('lww', () => {
    it('keeps value with latest timestamp', () => {
      const a = { value: 'old', timestamp: 1 }
      const b = { value: 'new', timestamp: 2 }
      expect(lattices.lww.merge(a, b).value).toBe('new')
      expect(lattices.lww.merge(b, a).value).toBe('new')
    })
  })

  describe('boolean', () => {
    it('ORs values', () => {
      expect(lattices.boolean.merge(false, false)).toBe(false)
      expect(lattices.boolean.merge(false, true)).toBe(true)
      expect(lattices.boolean.merge(true, false)).toBe(true)
    })
  })

  describe('object', () => {
    it('merges objects', () => {
      const result = lattices.object.merge({ a: 1 }, { b: 2 })
      expect(result).toEqual({ a: 1, b: 2 })
    })

    it('later values override', () => {
      const result = lattices.object.merge({ a: 1 }, { a: 2 })
      expect(result.a).toBe(2)
    })
  })
})

describe('createCells', () => {
  it('lists cells at root', async () => {
    const cells = createCells()
    const result = await cells.get({ path: '/' })

    expect(result.headers.type).toBe('/types/bassline')
    expect(result.body.name).toBe('cells')
  })

  it('creates cell with lattice', async () => {
    const cells = createCells()
    // Routing via bind extracts name param automatically
    const result = await cells.put({ path: '/counter' }, { lattice: 'maxNumber' })

    expect(result.body.lattice).toBe('maxNumber')
    expect(result.body.value).toBe(-Infinity)
  })

  it('rejects unknown lattice', async () => {
    const cells = createCells()
    const result = await cells.put({ path: '/test' }, { lattice: 'notALattice' })

    expect(result.headers.condition).toBe('invalid')
    expect(result.headers.message).toContain('Unknown lattice')
  })

  it('gets cell config', async () => {
    const cells = createCells()

    await cells.put({ path: '/counter' }, { lattice: 'maxNumber' })

    const result = await cells.get({ path: '/counter' })
    expect(result.headers.type).toBe('/types/cell')
    expect(result.body.lattice).toBe('maxNumber')
  })

  it('returns not-found for missing cell', async () => {
    const cells = createCells()
    const result = await cells.get({ path: '/missing' })
    expect(result.headers.condition).toBe('not-found')
  })

  it('gets cell value', async () => {
    const cells = createCells()

    await cells.put({ path: '/counter' }, { lattice: 'maxNumber' })
    await cells.put({ path: '/counter/value' }, 10)

    const result = await cells.get({ path: '/counter/value' })
    expect(result.body).toBe(10)
  })

  it('merges values according to lattice', async () => {
    const cells = createCells()

    await cells.put({ path: '/counter' }, { lattice: 'maxNumber' })

    await cells.put({ path: '/counter/value' }, 10)
    await cells.put({ path: '/counter/value' }, 5)
    await cells.put({ path: '/counter/value' }, 15)

    const result = await cells.get({ path: '/counter/value' })
    expect(result.body).toBe(15)
  })

  it('notifies kit on value change', async () => {
    const kit = createMockKit()
    const cells = createCells()

    await cells.put({ path: '/counter' }, { lattice: 'maxNumber' })
    await cells.put({ path: '/counter/value', kit }, 10)

    const calls = kit.calls()
    expect(calls.length).toBe(1)
    expect(calls[0].headers.path).toBe('/changed')
    expect(calls[0].body.value).toBe(10)
  })

  it('does not notify kit when value unchanged', async () => {
    const kit = createMockKit()
    const cells = createCells()

    await cells.put({ path: '/counter' }, { lattice: 'maxNumber' })

    // First write
    await cells.put({ path: '/counter/value', kit }, 10)

    kit.reset()

    // Second write with lower value (max lattice won't change)
    await cells.put({ path: '/counter/value', kit }, 5)

    const calls = kit.calls()
    expect(calls.length).toBe(0)
  })

  it('returns changed flag in headers', async () => {
    const cells = createCells()

    await cells.put({ path: '/counter' }, { lattice: 'maxNumber' })

    const result1 = await cells.put({ path: '/counter/value' }, 10)
    expect(result1.headers.changed).toBe(true)

    const result2 = await cells.put({ path: '/counter/value' }, 5)
    expect(result2.headers.changed).toBe(false)
  })
})
