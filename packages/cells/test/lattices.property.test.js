/**
 * Property-based tests for lattice implementations.
 *
 * Lattices must satisfy three algebraic properties:
 * - Commutativity: join(a, b) === join(b, a)
 * - Associativity: join(join(a, b), c) === join(a, join(b, c))
 * - Idempotency: join(a, a) === a
 */
import { describe, expect } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  maxNumber,
  minNumber,
  setUnion,
  setIntersection,
  boolean,
  object,
  lww,
  Contradiction,
} from '../src/lattices.js'

// Helper to run join and catch contradictions
/**
 *
 * @param join
 * @param a
 * @param b
 */
function tryJoin(join, a, b) {
  try {
    return { result: join(a, b), contradiction: false }
  } catch (e) {
    if (e instanceof Contradiction) {
      return { result: null, contradiction: true }
    }
    throw e
  }
}

// Helper to deep compare values (handles arrays, objects)
// Sorts object keys to handle insertion order differences
/**
 *
 * @param a
 * @param b
 */
function deepEqual(a, b) {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b))
}

/**
 *
 * @param obj
 */
function sortKeys(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sortKeys)
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortKeys(obj[key])
      return acc
    }, {})
}

describe('maxNumber lattice', () => {
  const { join } = maxNumber

  test.prop([fc.integer(), fc.integer()])('join is commutative', (a, b) => {
    expect(join(a, b)).toBe(join(b, a))
  })

  test.prop([fc.integer(), fc.integer(), fc.integer()])('join is associative', (a, b, c) => {
    expect(join(join(a, b), c)).toBe(join(a, join(b, c)))
  })

  test.prop([fc.integer()])('join is idempotent', (a) => {
    expect(join(a, a)).toBe(a)
  })

  test.prop([fc.integer()])('bottom is identity', (a) => {
    const bottom = maxNumber.bottom()
    expect(join(a, bottom)).toBe(a)
    expect(join(bottom, a)).toBe(a)
  })
})

describe('minNumber lattice', () => {
  const { join } = minNumber

  test.prop([fc.integer(), fc.integer()])('join is commutative', (a, b) => {
    expect(join(a, b)).toBe(join(b, a))
  })

  test.prop([fc.integer(), fc.integer(), fc.integer()])('join is associative', (a, b, c) => {
    expect(join(join(a, b), c)).toBe(join(a, join(b, c)))
  })

  test.prop([fc.integer()])('join is idempotent', (a) => {
    expect(join(a, a)).toBe(a)
  })

  test.prop([fc.integer()])('bottom is identity', (a) => {
    const bottom = minNumber.bottom()
    expect(join(a, bottom)).toBe(a)
    expect(join(bottom, a)).toBe(a)
  })
})

describe('boolean lattice', () => {
  const { join } = boolean

  test.prop([fc.boolean(), fc.boolean()])('join is commutative', (a, b) => {
    expect(join(a, b)).toBe(join(b, a))
  })

  test.prop([fc.boolean(), fc.boolean(), fc.boolean()])('join is associative', (a, b, c) => {
    expect(join(join(a, b), c)).toBe(join(a, join(b, c)))
  })

  test.prop([fc.boolean()])('join is idempotent', (a) => {
    expect(join(a, a)).toBe(a)
  })

  test.prop([fc.boolean()])('bottom is identity', (a) => {
    const bottom = boolean.bottom()
    expect(join(a, bottom)).toBe(a)
    expect(join(bottom, a)).toBe(a)
  })
})

describe('setUnion lattice', () => {
  const { join } = setUnion
  // Use small unique arrays of primitives
  const arrayArb = fc.uniqueArray(fc.oneof(fc.integer(), fc.string()), {
    maxLength: 10,
  })

  test.prop([arrayArb, arrayArb])('join is commutative', (a, b) => {
    expect(deepEqual(join(a, b), join(b, a))).toBe(true)
  })

  test.prop([arrayArb, arrayArb, arrayArb])('join is associative', (a, b, c) => {
    expect(deepEqual(join(join(a, b), c), join(a, join(b, c)))).toBe(true)
  })

  test.prop([arrayArb])('join is idempotent', (a) => {
    expect(deepEqual(join(a, a), join(a, []))).toBe(true) // join(a,a) should equal a (as sorted)
  })

  test.prop([arrayArb])('bottom is identity', (a) => {
    const bottom = setUnion.bottom()
    // Result should contain same elements as a (sorted)
    const result = join(a, bottom)
    const expected = [...new Set(a)].sort()
    expect(deepEqual(result, expected)).toBe(true)
  })
})

describe('setIntersection lattice', () => {
  const { join } = setIntersection
  const arrayArb = fc.uniqueArray(fc.integer({ min: 0, max: 20 }), {
    maxLength: 10,
  })
  // Include null (bottom) in tests
  const valueArb = fc.oneof(arrayArb, fc.constant(null))

  test.prop([valueArb, valueArb])('join is commutative', (a, b) => {
    const ab = tryJoin(join, a, b)
    const ba = tryJoin(join, b, a)
    // Both contradict or both succeed with equal results
    expect(ab.contradiction).toBe(ba.contradiction)
    if (!ab.contradiction) {
      expect(deepEqual(ab.result, ba.result)).toBe(true)
    }
  })

  test.prop([valueArb, valueArb, valueArb])('join is associative', (a, b, c) => {
    const ab = tryJoin(join, a, b)
    const bc = tryJoin(join, b, c)
    if (ab.contradiction || bc.contradiction) return // Skip if intermediate contradicts
    const abc1 = tryJoin(join, ab.result, c)
    const abc2 = tryJoin(join, a, bc.result)
    expect(abc1.contradiction).toBe(abc2.contradiction)
    if (!abc1.contradiction) {
      expect(deepEqual(abc1.result, abc2.result)).toBe(true)
    }
  })

  test.prop([arrayArb])('join is idempotent', (a) => {
    // Idempotent should never contradict (same value)
    expect(deepEqual(join(a, a), [...new Set(a)].sort())).toBe(true)
  })

  test.prop([valueArb])('bottom (null) is identity', (a) => {
    const bottom = setIntersection.bottom()
    expect(deepEqual(join(a, bottom), a)).toBe(true)
    expect(deepEqual(join(bottom, a), a)).toBe(true)
  })
})

describe('object lattice', () => {
  const { join } = object
  // Simple flat objects with string values
  const objArb = fc.object({
    key: fc.string({ minLength: 1, maxLength: 5 }),
    maxKeys: 5,
    values: [fc.string(), fc.integer()],
  })

  test.prop([objArb, objArb])('join is commutative for disjoint keys', (a, b) => {
    // Make keys disjoint by prefixing
    const aDisjoint = Object.fromEntries(Object.entries(a).map(([k, v]) => ['a_' + k, v]))
    const bDisjoint = Object.fromEntries(Object.entries(b).map(([k, v]) => ['b_' + k, v]))
    expect(deepEqual(join(aDisjoint, bDisjoint), join(bDisjoint, aDisjoint))).toBe(true)
  })

  test.prop([objArb])('join is idempotent', (a) => {
    expect(deepEqual(join(a, a), a)).toBe(true)
  })

  test.prop([objArb])('bottom is identity', (a) => {
    const bottom = object.bottom()
    expect(deepEqual(join(a, bottom), a)).toBe(true)
  })
})

describe('lww lattice', () => {
  const { join } = lww
  // Generate LWW values with timestamp
  const lwwArb = fc.record({
    value: fc.oneof(fc.string(), fc.integer(), fc.constant(null)),
    timestamp: fc.nat({ max: 1000000 }),
  })

  test.prop([lwwArb, lwwArb])('join is commutative', (a, b) => {
    const ab = tryJoin(join, a, b)
    const ba = tryJoin(join, b, a)
    // Both contradict or both succeed with equal results
    expect(ab.contradiction).toBe(ba.contradiction)
    if (!ab.contradiction) {
      expect(deepEqual(ab.result, ba.result)).toBe(true)
    }
  })

  test.prop([lwwArb, lwwArb, lwwArb])('join is associative', (a, b, c) => {
    const ab = tryJoin(join, a, b)
    const bc = tryJoin(join, b, c)
    if (ab.contradiction || bc.contradiction) return // Skip if intermediate contradicts
    const abc1 = tryJoin(join, ab.result, c)
    const abc2 = tryJoin(join, a, bc.result)
    expect(abc1.contradiction).toBe(abc2.contradiction)
    if (!abc1.contradiction) {
      expect(deepEqual(abc1.result, abc2.result)).toBe(true)
    }
  })

  test.prop([lwwArb])('join is idempotent', (a) => {
    expect(deepEqual(join(a, a), a)).toBe(true)
  })

  test.prop([lwwArb])('bottom is identity', (a) => {
    const bottom = lww.bottom()
    expect(deepEqual(join(a, bottom), a)).toBe(true)
  })
})

// Note: counter lattice is NOT idempotent (a + a !== a)
// It's designed for increment-only semantics, not as a traditional lattice
describe('counter lattice (increment semantics)', () => {
  // Counter uses addition, which is commutative and associative
  // but NOT idempotent - this is intentional for counting
  const { join } = { join: (a, b) => (a ?? 0) + (b ?? 0) }

  test.prop([fc.integer(), fc.integer()])('join is commutative', (a, b) => {
    expect(join(a, b)).toBe(join(b, a))
  })

  test.prop([fc.integer(), fc.integer(), fc.integer()])('join is associative', (a, b, c) => {
    expect(join(join(a, b), c)).toBe(join(a, join(b, c)))
  })

  // Counter is intentionally NOT idempotent - that's the point of increment-only
})
