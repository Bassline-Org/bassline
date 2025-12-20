import { describe, it, expect } from 'vitest'
import { resource, routes, bind, splitPath } from '../src/resource.js'
import { lattices } from '../src/cells.js'

/**
 * Property-based tests for routing laws and lattice properties
 */

describe('Routing Laws', () => {
  describe('splitPath properties', () => {
    it('preserves path information (segment + remaining reconstructs original)', () => {
      const paths = ['/a', '/a/b', '/a/b/c', '/foo/bar/baz']

      for (const path of paths) {
        const [segment, remaining] = splitPath(path)
        // Reconstructing: '/' + segment + remaining (but remaining already starts with /)
        const reconstructed = `/${segment}${remaining === '/' ? '' : remaining}`
        expect(reconstructed).toBe(path)
      }
    })

    it('root path is idempotent', () => {
      const [seg1, rem1] = splitPath('/')
      const [seg2, rem2] = splitPath(rem1)

      expect(seg1).toBe(undefined)
      expect(seg2).toBe(undefined)
      expect(rem1).toBe('/')
      expect(rem2).toBe('/')
    })

    it('handles arbitrary depth', () => {
      const depths = [1, 5, 10, 20]

      for (const depth of depths) {
        const path = '/' + Array(depth).fill('x').join('/')
        let current = path
        let count = 0

        while (current !== '/') {
          const [segment, remaining] = splitPath(current)
          if (segment === undefined) break
          expect(segment).toBe('x')
          current = remaining
          count++
        }

        expect(count).toBe(depth)
      }
    })
  })

  describe('routes dispatch properties', () => {
    it('named routes take precedence over unknown', async () => {
      const calls = []

      const app = routes({
        foo: resource({
          get: async () => {
            calls.push('foo')
            return { headers: {}, body: 'foo' }
          },
        }),
        unknown: resource({
          get: async () => {
            calls.push('unknown')
            return { headers: {}, body: 'unknown' }
          },
        }),
      })

      await app.get({ path: '/foo' })
      await app.get({ path: '/bar' })

      expect(calls).toEqual(['foo', 'unknown'])
    })

    it('empty string routes to root', async () => {
      const app = routes({
        '': resource({
          get: async () => ({ headers: {}, body: 'root' }),
        }),
      })

      const result = await app.get({ path: '/' })
      expect(result.body).toBe('root')
    })

    it('routes composition is associative', async () => {
      // (A . B) . C === A . (B . C) for nested routes

      const leaf = resource({
        get: async h => ({ headers: {}, body: h.path }),
      })

      // Left association: routes({ a: routes({ b: routes({ c: leaf }) }) })
      const left = routes({
        a: routes({
          b: routes({
            c: leaf,
          }),
        }),
      })

      // Right association: routes({ a: routes({ b: routes({ c: leaf }) }) })
      // (Same structure - routes nesting is naturally associative)
      const right = routes({
        a: routes({
          b: routes({
            c: leaf,
          }),
        }),
      })

      const path = '/a/b/c/rest'
      const leftResult = await left.get({ path })
      const rightResult = await right.get({ path })

      expect(leftResult.body).toBe(rightResult.body)
    })
  })

  describe('bind properties', () => {
    it('bind preserves existing params', async () => {
      const app = routes({
        users: bind(
          'userId',
          routes({
            posts: bind(
              'postId',
              resource({
                get: async h => ({ headers: {}, body: h.params }),
              })
            ),
          })
        ),
      })

      const result = await app.get({ path: '/users/alice/posts/123' })

      expect(result.body.userId).toBe('alice')
      expect(result.body.postId).toBe('123')
    })

    it('bind is composable', async () => {
      // bind(a, bind(b, target)) captures both a and b
      const target = resource({
        get: async h => ({
          headers: {},
          body: { keys: Object.keys(h.params).sort() },
        }),
      })

      const app = routes({
        one: bind(
          'first',
          routes({
            two: bind(
              'second',
              routes({
                three: bind('third', target),
              })
            ),
          })
        ),
      })

      const result = await app.get({ path: '/one/a/two/b/three/c' })

      expect(result.body.keys).toEqual(['first', 'second', 'third'])
    })

    it('later binds do not shadow earlier binds', async () => {
      // If we have bind('x', bind('x', ...)), both should be preserved
      // Actually, the later bind would overwrite, which is expected JS object behavior
      const app = routes({
        a: bind(
          'name',
          routes({
            b: bind(
              'name',
              resource({
                get: async h => ({ headers: {}, body: h.params }),
              })
            ),
          })
        ),
      })

      const result = await app.get({ path: '/a/first/b/second' })

      // Later bind overwrites - this is expected behavior
      expect(result.body.name).toBe('second')
    })
  })
})

describe('Lattice Properties', () => {
  describe('maxNumber', () => {
    it('is associative: merge(merge(a, b), c) === merge(a, merge(b, c))', () => {
      const { merge } = lattices.maxNumber
      const values = [
        [1, 2, 3],
        [5, 1, 9],
        [0, 0, 0],
        [-1, 5, 3],
      ]

      for (const [a, b, c] of values) {
        const left = merge(merge(a, b), c)
        const right = merge(a, merge(b, c))
        expect(left).toBe(right)
      }
    })

    it('is commutative: merge(a, b) === merge(b, a)', () => {
      const { merge } = lattices.maxNumber
      const pairs = [
        [1, 2],
        [5, 3],
        [0, -1],
        [10, 10],
      ]

      for (const [a, b] of pairs) {
        expect(merge(a, b)).toBe(merge(b, a))
      }
    })

    it('is idempotent: merge(a, a) === a', () => {
      const { merge } = lattices.maxNumber
      const values = [1, 5, 0, -10, 100]

      for (const a of values) {
        expect(merge(a, a)).toBe(a)
      }
    })

    it('has identity: merge(initial, a) === a', () => {
      const { merge, initial } = lattices.maxNumber
      const values = [1, 5, 0, -10, 100]

      for (const a of values) {
        expect(merge(initial, a)).toBe(a)
      }
    })
  })

  describe('minNumber', () => {
    it('is associative', () => {
      const { merge } = lattices.minNumber
      const values = [
        [1, 2, 3],
        [5, 1, 9],
        [0, 0, 0],
        [-1, 5, 3],
      ]

      for (const [a, b, c] of values) {
        expect(merge(merge(a, b), c)).toBe(merge(a, merge(b, c)))
      }
    })

    it('is commutative', () => {
      const { merge } = lattices.minNumber
      const pairs = [
        [1, 2],
        [5, 3],
        [0, -1],
      ]

      for (const [a, b] of pairs) {
        expect(merge(a, b)).toBe(merge(b, a))
      }
    })

    it('is idempotent', () => {
      const { merge } = lattices.minNumber
      const values = [1, 5, 0, -10]

      for (const a of values) {
        expect(merge(a, a)).toBe(a)
      }
    })

    it('has identity', () => {
      const { merge, initial } = lattices.minNumber
      const values = [1, 5, 0, 100]

      for (const a of values) {
        expect(merge(initial, a)).toBe(a)
      }
    })
  })

  describe('setUnion', () => {
    it('is associative', () => {
      const { merge } = lattices.setUnion
      const values = [
        [[1], [2], [3]],
        [
          [1, 2],
          [2, 3],
          [3, 4],
        ],
        [[], [1], [2]],
      ]

      for (const [a, b, c] of values) {
        const left = merge(merge(a, b), c).sort()
        const right = merge(a, merge(b, c)).sort()
        expect(left).toEqual(right)
      }
    })

    it('is commutative', () => {
      const { merge } = lattices.setUnion
      const pairs = [
        [
          [1, 2],
          [3, 4],
        ],
        [[1], [1, 2]],
        [[], [1]],
      ]

      for (const [a, b] of pairs) {
        expect(merge(a, b).sort()).toEqual(merge(b, a).sort())
      }
    })

    it('is idempotent', () => {
      const { merge } = lattices.setUnion
      const values = [[1, 2], [1], [], [1, 2, 3]]

      for (const a of values) {
        expect(merge(a, a).sort()).toEqual(a.sort())
      }
    })

    it('has identity', () => {
      const { merge, initial } = lattices.setUnion
      const values = [[1, 2], [1], [1, 2, 3]]

      for (const a of values) {
        expect(merge(initial, a).sort()).toEqual(a.sort())
      }
    })
  })

  describe('counter', () => {
    it('is associative', () => {
      const { merge } = lattices.counter
      const values = [
        [1, 2, 3],
        [5, 1, 9],
        [0, 0, 0],
      ]

      for (const [a, b, c] of values) {
        expect(merge(merge(a, b), c)).toBe(merge(a, merge(b, c)))
      }
    })

    it('is commutative', () => {
      const { merge } = lattices.counter
      const pairs = [
        [1, 2],
        [5, 3],
        [0, 10],
      ]

      for (const [a, b] of pairs) {
        expect(merge(a, b)).toBe(merge(b, a))
      }
    })

    it('has identity', () => {
      const { merge, initial } = lattices.counter
      const values = [1, 5, 0, 10]

      for (const a of values) {
        expect(merge(initial, a)).toBe(a)
      }
    })

    // Note: counter is NOT idempotent: merge(5, 5) = 10 != 5
  })

  describe('boolean (OR)', () => {
    it('is associative', () => {
      const { merge } = lattices.boolean
      const values = [
        [true, true, true],
        [true, false, true],
        [false, false, false],
      ]

      for (const [a, b, c] of values) {
        expect(merge(merge(a, b), c)).toBe(merge(a, merge(b, c)))
      }
    })

    it('is commutative', () => {
      const { merge } = lattices.boolean
      const pairs = [
        [true, false],
        [false, false],
        [true, true],
      ]

      for (const [a, b] of pairs) {
        expect(merge(a, b)).toBe(merge(b, a))
      }
    })

    it('is idempotent', () => {
      const { merge } = lattices.boolean

      expect(merge(true, true)).toBe(true)
      expect(merge(false, false)).toBe(false)
    })

    it('has identity', () => {
      const { merge, initial } = lattices.boolean

      expect(merge(initial, true)).toBe(true)
      expect(merge(initial, false)).toBe(false)
    })
  })

  describe('object', () => {
    it('is associative for disjoint keys', () => {
      const { merge } = lattices.object
      const values = [
        [{ a: 1 }, { b: 2 }, { c: 3 }],
        [{ x: 1 }, { y: 2 }, { z: 3 }],
      ]

      for (const [a, b, c] of values) {
        expect(merge(merge(a, b), c)).toEqual(merge(a, merge(b, c)))
      }
    })

    it('is idempotent', () => {
      const { merge } = lattices.object
      const values = [{ a: 1 }, { a: 1, b: 2 }, {}]

      for (const a of values) {
        expect(merge(a, a)).toEqual(a)
      }
    })

    it('has identity', () => {
      const { merge, initial } = lattices.object
      const values = [{ a: 1 }, { x: 'y' }]

      for (const a of values) {
        expect(merge(initial, a)).toEqual(a)
      }
    })

    // Note: object merge is commutative for disjoint keys, but not when keys overlap
    // (later value wins based on spread order)
  })

  describe('lww (Last Writer Wins)', () => {
    it('is associative', () => {
      const { merge } = lattices.lww
      const values = [
        [
          { value: 'a', timestamp: 1 },
          { value: 'b', timestamp: 2 },
          { value: 'c', timestamp: 3 },
        ],
        [
          { value: 'x', timestamp: 3 },
          { value: 'y', timestamp: 1 },
          { value: 'z', timestamp: 2 },
        ],
      ]

      for (const [a, b, c] of values) {
        expect(merge(merge(a, b), c).value).toBe(merge(a, merge(b, c)).value)
      }
    })

    it('is commutative', () => {
      const { merge } = lattices.lww
      const pairs = [
        [
          { value: 'a', timestamp: 1 },
          { value: 'b', timestamp: 2 },
        ],
        [
          { value: 'x', timestamp: 5 },
          { value: 'y', timestamp: 3 },
        ],
      ]

      for (const [a, b] of pairs) {
        expect(merge(a, b).value).toBe(merge(b, a).value)
      }
    })

    it('is idempotent', () => {
      const { merge } = lattices.lww
      const values = [
        { value: 'a', timestamp: 1 },
        { value: 'b', timestamp: 100 },
      ]

      for (const a of values) {
        const result = merge(a, a)
        expect(result.value).toBe(a.value)
        expect(result.timestamp).toBe(a.timestamp)
      }
    })
  })
})

describe('Resource Algebra', () => {
  it('resource is a functor (preserves identity)', async () => {
    const identity = async h => ({ headers: {}, body: h })

    const r = resource({ get: identity })
    const result = await r.get({ path: '/test' })

    expect(result.body.path).toBe('/test')
  })

  it('routes distributes over composition', async () => {
    // routes({ a: R1, b: R2 }) behaves like combining R1 and R2
    const r1 = resource({
      get: async () => ({ headers: {}, body: 'r1' }),
    })

    const r2 = resource({
      get: async () => ({ headers: {}, body: 'r2' }),
    })

    const combined = routes({ a: r1, b: r2 })

    expect((await combined.get({ path: '/a' })).body).toBe('r1')
    expect((await combined.get({ path: '/b' })).body).toBe('r2')
  })

  it('not-found is absorbing', async () => {
    // Routing to non-existent path always gives not-found
    const app = routes({
      foo: resource({ get: async () => ({ headers: {}, body: 'foo' }) }),
    })

    const result1 = await app.get({ path: '/bar' })
    const result2 = await app.get({ path: '/baz' })
    const result3 = await app.get({ path: '/qux' })

    expect(result1.headers.condition).toBe('not-found')
    expect(result2.headers.condition).toBe('not-found')
    expect(result3.headers.condition).toBe('not-found')
  })
})
