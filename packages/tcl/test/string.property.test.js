import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { Runtime, std, string } from '../src/index.js'

/**
 * Property-based tests for Tcl string operations
 */

function createRuntime() {
  const rt = new Runtime()
  for (const [n, fn] of Object.entries(std)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(string)) rt.register(n, fn)
  return rt
}

// Arbitrary for safe strings (no special Tcl chars)
const arbString = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')),
  minLength: 0,
  maxLength: 20,
})

// Arbitrary for non-empty strings
const arbNonEmptyString = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')),
  minLength: 1,
  maxLength: 20,
})

describe('String Properties', () => {
  describe('Length Properties', () => {
    it('string length returns correct count', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const len = Number(await rt.run(`string length {${str}}`))
          expect(len).toBe(str.length)
        }),
        { numRuns: 20 }
      )
    })

    it('string concat length equals sum of lengths', async () => {
      fc.assert(
        fc.asyncProperty(arbString, arbString, async (s1, s2) => {
          const rt = createRuntime()
          const result = await rt.run(`string concat {${s1}} {${s2}}`)
          const resultLen = Number(await rt.run(`string length {${result}}`))

          expect(resultLen).toBe(s1.length + s2.length)
        }),
        { numRuns: 20 }
      )
    })

    it('string repeat length equals original * count', async () => {
      fc.assert(
        fc.asyncProperty(arbString, fc.integer({ min: 0, max: 5 }), async (str, count) => {
          const rt = createRuntime()
          const result = await rt.run(`string repeat {${str}} ${count}`)
          const resultLen = Number(await rt.run(`string length {${result}}`))

          expect(resultLen).toBe(str.length * count)
        }),
        { numRuns: 20 }
      )
    })

    it('string reverse preserves length', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const reversed = await rt.run(`string reverse {${str}}`)
          const reversedLen = Number(await rt.run(`string length {${reversed}}`))

          expect(reversedLen).toBe(str.length)
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('Reverse Properties', () => {
    it('string reverse is involutive', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const twice = await rt.run(`string reverse [string reverse {${str}}]`)
          expect(twice).toBe(str)
        }),
        { numRuns: 20 }
      )
    })

    it('single char reverses to itself', async () => {
      fc.assert(
        fc.asyncProperty(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), async char => {
          const rt = createRuntime()
          const reversed = await rt.run(`string reverse {${char}}`)
          expect(reversed).toBe(char)
        }),
        { numRuns: 15 }
      )
    })

    it('empty string reverses to itself', async () => {
      const rt = createRuntime()
      const reversed = await rt.run('string reverse {}')
      expect(reversed).toBe('')
    })
  })

  describe('Case Conversion Properties', () => {
    it('tolower is idempotent', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const once = await rt.run(`string tolower {${str}}`)
          const twice = await rt.run(`string tolower [string tolower {${str}}]`)
          expect(once).toBe(twice)
        }),
        { numRuns: 20 }
      )
    })

    it('toupper is idempotent', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const once = await rt.run(`string toupper {${str}}`)
          const twice = await rt.run(`string toupper [string toupper {${str}}]`)
          expect(once).toBe(twice)
        }),
        { numRuns: 20 }
      )
    })

    it('tolower preserves length', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const lower = await rt.run(`string tolower {${str}}`)
          expect(lower.length).toBe(str.length)
        }),
        { numRuns: 20 }
      )
    })

    it('toupper preserves length', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const upper = await rt.run(`string toupper {${str}}`)
          expect(upper.length).toBe(str.length)
        }),
        { numRuns: 20 }
      )
    })

    it('toupper of tolower equals toupper', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const lowerThenUpper = await rt.run(`string toupper [string tolower {${str}}]`)
          const justUpper = await rt.run(`string toupper {${str}}`)
          expect(lowerThenUpper).toBe(justUpper)
        }),
        { numRuns: 20 }
      )
    })

    it('tolower of toupper equals tolower', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const upperThenLower = await rt.run(`string tolower [string toupper {${str}}]`)
          const justLower = await rt.run(`string tolower {${str}}`)
          expect(upperThenLower).toBe(justLower)
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('Comparison Properties', () => {
    it('string equal is reflexive', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const result = await rt.run(`string equal {${str}} {${str}}`)
          expect(result).toBe('1')
        }),
        { numRuns: 20 }
      )
    })

    it('string compare with self returns 0', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const result = Number(await rt.run(`string compare {${str}} {${str}}`))
          expect(result).toBe(0)
        }),
        { numRuns: 20 }
      )
    })

    it('string compare is antisymmetric', async () => {
      fc.assert(
        fc.asyncProperty(arbString, arbString, async (s1, s2) => {
          const rt = createRuntime()
          const cmp1 = Number(await rt.run(`string compare {${s1}} {${s2}}`))
          const cmp2 = Number(await rt.run(`string compare {${s2}} {${s1}}`))

          // If cmp1 > 0, then cmp2 < 0 (and vice versa), or both are 0
          // Use + 0 to normalize -0 to 0 for comparison
          expect(cmp1 + 0).toBe(-cmp2 + 0)
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('Indexing Properties', () => {
    it('string index returns correct character', async () => {
      fc.assert(
        fc.asyncProperty(arbNonEmptyString, fc.nat(), async (str, idx) => {
          const i = idx % str.length
          const rt = createRuntime()

          const char = await rt.run(`string index {${str}} ${i}`)
          expect(char).toBe(str[i])
        }),
        { numRuns: 20 }
      )
    })

    it('string first returns 0 for first char', async () => {
      fc.assert(
        fc.asyncProperty(arbNonEmptyString, async str => {
          const rt = createRuntime()
          const first = await rt.run(`string first {${str}}`)
          expect(first).toBe(str[0])
        }),
        { numRuns: 15 }
      )
    })

    it('string last returns last char', async () => {
      fc.assert(
        fc.asyncProperty(arbNonEmptyString, async str => {
          const rt = createRuntime()
          const last = await rt.run(`string last {${str}}`)
          expect(last).toBe(str[str.length - 1])
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Range Properties', () => {
    it('string range 0 to length-1 returns original', async () => {
      fc.assert(
        fc.asyncProperty(arbNonEmptyString, async str => {
          const rt = createRuntime()
          const result = await rt.run(`string range {${str}} 0 ${str.length - 1}`)
          expect(result).toBe(str)
        }),
        { numRuns: 20 }
      )
    })

    it('string range 0 to end returns original', async () => {
      fc.assert(
        fc.asyncProperty(arbNonEmptyString, async str => {
          const rt = createRuntime()
          const result = await rt.run(`string range {${str}} 0 end`)
          expect(result).toBe(str)
        }),
        { numRuns: 20 }
      )
    })

    it('string range single char returns that char', async () => {
      fc.assert(
        fc.asyncProperty(arbNonEmptyString, fc.nat(), async (str, idx) => {
          const i = idx % str.length
          const rt = createRuntime()
          const result = await rt.run(`string range {${str}} ${i} ${i}`)
          expect(result).toBe(str[i])
        }),
        { numRuns: 20 }
      )
    })

    it('string range end-N works correctly', async () => {
      fc.assert(
        fc.asyncProperty(arbNonEmptyString, async str => {
          fc.pre(str.length >= 2)
          const rt = createRuntime()
          const result = await rt.run(`string range {${str}} end-1 end`)
          expect(result).toBe(str.slice(-2))
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Trim Properties', () => {
    it('trim is idempotent', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const once = await rt.run(`string trim {${str}}`)
          const twice = await rt.run(`string trim [string trim {${str}}]`)
          expect(once).toBe(twice)
        }),
        { numRuns: 15 }
      )
    })

    it('trimleft followed by trimright equals trim', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const leftThenRight = await rt.run(`string trimright [string trimleft {${str}}]`)
          const justTrim = await rt.run(`string trim {${str}}`)
          expect(leftThenRight).toBe(justTrim)
        }),
        { numRuns: 15 }
      )
    })

    it('trim never increases length', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const trimmed = await rt.run(`string trim {${str}}`)
          expect(trimmed.length).toBeLessThanOrEqual(str.length)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Repeat Properties', () => {
    it('repeat 0 times gives empty string', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const result = await rt.run(`string repeat {${str}} 0`)
          expect(result).toBe('')
        }),
        { numRuns: 15 }
      )
    })

    it('repeat 1 time gives original', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const result = await rt.run(`string repeat {${str}} 1`)
          expect(result).toBe(str)
        }),
        { numRuns: 15 }
      )
    })

    it('repeat 2 times equals concat with self', async () => {
      fc.assert(
        fc.asyncProperty(arbString, async str => {
          const rt = createRuntime()
          const repeated = await rt.run(`string repeat {${str}} 2`)
          const concated = await rt.run(`string concat {${str}} {${str}}`)
          expect(repeated).toBe(concated)
        }),
        { numRuns: 15 }
      )
    })
  })
})
