import { describe, it, expect } from 'vitest'
import { createFn, builtins } from '../src/fn.js'

describe('builtins', () => {
  describe('arithmetic', () => {
    it('sum adds values', () => {
      expect(builtins.sum(1, 2, 3)).toBe(6)
      expect(builtins.sum([1, 2, 3])).toBe(6)
    })

    it('product multiplies values', () => {
      expect(builtins.product(2, 3, 4)).toBe(24)
      expect(builtins.product([2, 3])).toBe(6)
    })

    it('subtract subtracts', () => {
      expect(builtins.subtract(10, 3)).toBe(7)
    })

    it('divide divides', () => {
      expect(builtins.divide(10, 2)).toBe(5)
    })

    it('negate negates', () => {
      expect(builtins.negate(5)).toBe(-5)
    })

    it('abs returns absolute value', () => {
      expect(builtins.abs(-5)).toBe(5)
    })

    it('mod returns modulo', () => {
      expect(builtins.mod(10, 3)).toBe(1)
    })
  })

  describe('comparison', () => {
    it('min returns minimum', () => {
      expect(builtins.min(1, 2, 3)).toBe(1)
      expect(builtins.min([5, 2, 8])).toBe(2)
    })

    it('max returns maximum', () => {
      expect(builtins.max(1, 2, 3)).toBe(3)
    })

    it('gt/lt/gte/lte compare values', () => {
      expect(builtins.gt(5, 3)).toBe(true)
      expect(builtins.lt(3, 5)).toBe(true)
      expect(builtins.gte(5, 5)).toBe(true)
      expect(builtins.lte(5, 5)).toBe(true)
    })

    it('eq/neq check equality', () => {
      expect(builtins.eq(5, 5)).toBe(true)
      expect(builtins.neq(5, 6)).toBe(true)
    })
  })

  describe('logic', () => {
    it('and returns true if all truthy', () => {
      expect(builtins.and(true, true)).toBe(true)
      expect(builtins.and(true, false)).toBe(false)
      expect(builtins.and([true, true, true])).toBe(true)
    })

    it('or returns true if any truthy', () => {
      expect(builtins.or(false, true)).toBe(true)
      expect(builtins.or(false, false)).toBe(false)
    })

    it('not negates', () => {
      expect(builtins.not(true)).toBe(false)
      expect(builtins.not(false)).toBe(true)
    })
  })

  describe('arrays', () => {
    it('first returns first element', () => {
      expect(builtins.first([1, 2, 3])).toBe(1)
    })

    it('last returns last element', () => {
      expect(builtins.last([1, 2, 3])).toBe(3)
    })

    it('length returns length', () => {
      expect(builtins.length([1, 2, 3])).toBe(3)
      expect(builtins.length(null)).toBe(0)
    })

    it('concat combines arrays', () => {
      expect(builtins.concat([1, 2], [3, 4])).toEqual([1, 2, 3, 4])
    })

    it('reverse reverses', () => {
      expect(builtins.reverse([1, 2, 3])).toEqual([3, 2, 1])
    })

    it('sort sorts', () => {
      expect(builtins.sort([3, 1, 2])).toEqual([1, 2, 3])
    })

    it('unique removes duplicates', () => {
      expect(builtins.unique([1, 2, 2, 3])).toEqual([1, 2, 3])
    })

    it('flatten flattens nested arrays', () => {
      expect(builtins.flatten([[1, [2]], [3]])).toEqual([1, 2, 3])
    })
  })

  describe('objects', () => {
    it('get retrieves property', () => {
      expect(builtins.get({ a: 1 }, 'a')).toBe(1)
    })

    it('set creates new object with property', () => {
      expect(builtins.set({ a: 1 }, 'b', 2)).toEqual({ a: 1, b: 2 })
    })

    it('keys returns keys', () => {
      expect(builtins.keys({ a: 1, b: 2 })).toEqual(['a', 'b'])
    })

    it('values returns values', () => {
      expect(builtins.values({ a: 1, b: 2 })).toEqual([1, 2])
    })

    it('entries returns entries', () => {
      expect(builtins.entries({ a: 1 })).toEqual([['a', 1]])
    })

    it('merge combines objects', () => {
      expect(builtins.merge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
    })

    it('pick extracts keys', () => {
      expect(builtins.pick({ a: 1, b: 2, c: 3 }, 'a', 'c')).toEqual({ a: 1, c: 3 })
    })

    it('omit removes keys', () => {
      expect(builtins.omit({ a: 1, b: 2, c: 3 }, 'b')).toEqual({ a: 1, c: 3 })
    })
  })

  describe('strings', () => {
    it('upper/lower case', () => {
      expect(builtins.upper('hello')).toBe('HELLO')
      expect(builtins.lower('HELLO')).toBe('hello')
    })

    it('trim removes whitespace', () => {
      expect(builtins.trim('  hello  ')).toBe('hello')
    })

    it('split splits string', () => {
      expect(builtins.split('a,b,c', ',')).toEqual(['a', 'b', 'c'])
    })

    it('join joins array', () => {
      expect(builtins.join(['a', 'b'], '-')).toBe('a-b')
    })

    it('replace replaces pattern', () => {
      expect(builtins.replace('hello world', 'o', '0')).toBe('hell0 w0rld')
    })
  })

  describe('type coercion', () => {
    it('number converts to number', () => {
      expect(builtins.number('42')).toBe(42)
    })

    it('string converts to string', () => {
      expect(builtins.string(42)).toBe('42')
    })

    it('boolean converts to boolean', () => {
      expect(builtins.boolean(1)).toBe(true)
      expect(builtins.boolean(0)).toBe(false)
    })

    it('json stringifies', () => {
      expect(builtins.json({ a: 1 })).toBe('{"a":1}')
    })

    it('parse parses JSON', () => {
      expect(builtins.parse('{"a":1}')).toEqual({ a: 1 })
    })
  })

  describe('utilities', () => {
    it('identity returns input', () => {
      expect(builtins.identity(5)).toBe(5)
    })

    it('constant returns function returning value', () => {
      const fn = builtins.constant(42)
      expect(fn()).toBe(42)
    })

    it('pair creates tuple', () => {
      expect(builtins.pair(1, 2)).toEqual([1, 2])
    })

    it('zip zips arrays', () => {
      expect(builtins.zip([1, 2], ['a', 'b'])).toEqual([
        [1, 'a'],
        [2, 'b'],
      ])
    })
  })

  describe('higher-order', () => {
    it('map transforms array', () => {
      const double = builtins.map(x => x * 2)
      expect(double([1, 2, 3])).toEqual([2, 4, 6])
    })

    it('filter filters array', () => {
      const evens = builtins.filter(x => x % 2 === 0)
      expect(evens([1, 2, 3, 4])).toEqual([2, 4])
    })

    it('reduce reduces array', () => {
      const sum = builtins.reduce((a, b) => a + b, 0)
      expect(sum([1, 2, 3])).toBe(6)
    })

    it('pipe composes left-to-right', () => {
      const fn = builtins.pipe(
        x => x + 1,
        x => x * 2
      )
      expect(fn(5)).toBe(12) // (5+1)*2
    })

    it('compose composes right-to-left', () => {
      const fn = builtins.compose(
        x => x * 2,
        x => x + 1
      )
      expect(fn(5)).toBe(12) // (5+1)*2
    })
  })
})

describe('createFn', () => {
  it('lists functions at root', async () => {
    const fn = createFn()
    const result = await fn.get({ path: '/' })

    expect(result.headers.type).toBe('/types/bassline')
    expect(result.body.name).toBe('fn')
    expect(result.body.resources).toHaveProperty('/sum')
  })

  it('gets builtin function', async () => {
    const fn = createFn()
    const result = await fn.get({ path: '/sum' })

    expect(result.headers.type).toBe('/types/fn')
    expect(typeof result.body).toBe('function')
    expect(result.body(1, 2, 3)).toBe(6)
  })

  it('returns not-found for unknown function', async () => {
    const fn = createFn()
    const result = await fn.get({ path: '/unknown' })

    expect(result.headers.condition).toBe('not-found')
  })

  it('accepts custom functions on creation', async () => {
    const fn = createFn({
      custom: (a, b) => a * b + 1,
    })

    const result = await fn.get({ path: '/custom' })
    expect(result.body(3, 4)).toBe(13)
  })

  it('registers new functions via put', async () => {
    const fn = createFn()
    const customFn = x => x * x

    await fn.put({ path: '/square' }, customFn)

    const result = await fn.get({ path: '/square' })
    expect(result.body(5)).toBe(25)
  })

  it('rejects non-function bodies', async () => {
    const fn = createFn()
    const result = await fn.put({ path: '/bad' }, 'not a function')

    expect(result.headers.condition).toBe('invalid')
    expect(result.headers.message).toContain('function')
  })
})
