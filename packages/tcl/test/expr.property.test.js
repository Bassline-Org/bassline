import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { expr, Runtime, std } from '../src/index.js'

/**
 * Property-based tests for the Tcl expression evaluator
 *
 * Note: expr() returns strings (EIAS - Everything Is A String in Tcl)
 * So we convert results to numbers for comparison.
 */

// Helper to create a runtime with std library
function createRuntime() {
  const rt = new Runtime()
  for (const [name, fn] of Object.entries(std)) {
    rt.register(name, fn)
  }
  return rt
}

// Helper to evaluate and convert to number
async function evalExpr(exprStr, rt) {
  return Number(await expr(exprStr, rt))
}

describe('Expression Evaluator Properties', () => {
  describe('Safety Properties', () => {
    it('never crashes on arbitrary string input', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.string(), async input => {
          try {
            await expr(input, rt)
          } catch (err) {
            expect(err).toBeInstanceOf(Error)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('handles very long expressions without stack overflow', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: 10, max: 50 }), async count => {
          const exprStr = Array(count).fill('1').join(' + ')
          try {
            const result = await evalExpr(exprStr, rt)
            expect(result).toBe(count)
          } catch (err) {
            expect(err).toBeInstanceOf(Error)
          }
        }),
        { numRuns: 10 }
      )
    })

    it('handles deeply nested parentheses', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 30 }), async depth => {
          const exprStr = '('.repeat(depth) + '42' + ')'.repeat(depth)
          try {
            const result = await evalExpr(exprStr, rt)
            expect(result).toBe(42)
          } catch (err) {
            expect(err).toBeInstanceOf(Error)
          }
        }),
        { numRuns: 10 }
      )
    })
  })

  describe('Arithmetic Properties', () => {
    it('addition is commutative: a + b === b + a', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }), async (a, b) => {
          const result1 = await evalExpr(`${a} + ${b}`, rt)
          const result2 = await evalExpr(`${b} + ${a}`, rt)
          expect(result1).toBe(result2)
        }),
        { numRuns: 50 }
      )
    })

    it('multiplication is commutative: a * b === b * a', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: -100, max: 100 }), fc.integer({ min: -100, max: 100 }), async (a, b) => {
          const result1 = await evalExpr(`${a} * ${b}`, rt)
          const result2 = await evalExpr(`${b} * ${a}`, rt)
          expect(result1).toBe(result2)
        }),
        { numRuns: 50 }
      )
    })

    it('addition is associative: (a + b) + c === a + (b + c)', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: -1000, max: 1000 }),
          fc.integer({ min: -1000, max: 1000 }),
          fc.integer({ min: -1000, max: 1000 }),
          async (a, b, c) => {
            const result1 = await evalExpr(`(${a} + ${b}) + ${c}`, rt)
            const result2 = await evalExpr(`${a} + (${b} + ${c})`, rt)
            expect(result1).toBe(result2)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('zero is additive identity: a + 0 === a', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: -10000, max: 10000 }), async a => {
          const result = await evalExpr(`${a} + 0`, rt)
          expect(result).toBe(a)
        }),
        { numRuns: 50 }
      )
    })

    it('one is multiplicative identity: a * 1 === a', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: -10000, max: 10000 }), async a => {
          const result = await evalExpr(`${a} * 1`, rt)
          expect(result).toBe(a)
        }),
        { numRuns: 50 }
      )
    })

    it('zero is multiplicative annihilator: a * 0 === 0', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: -10000, max: 10000 }), async a => {
          const result = await evalExpr(`${a} * 0`, rt)
          expect(result).toBe(0)
        }),
        { numRuns: 50 }
      )
    })

    it('distributive property: a * (b + c) === a*b + a*c', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: -50, max: 50 }),
          fc.integer({ min: -50, max: 50 }),
          fc.integer({ min: -50, max: 50 }),
          async (a, b, c) => {
            const result1 = await evalExpr(`${a} * (${b} + ${c})`, rt)
            const result2 = await evalExpr(`${a} * ${b} + ${a} * ${c}`, rt)
            expect(result1).toBe(result2)
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('Comparison Properties', () => {
    it('< and >= are complementary', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer(), fc.integer(), async (a, b) => {
          const lt = await evalExpr(`${a} < ${b}`, rt)
          const gte = await evalExpr(`${a} >= ${b}`, rt)
          // One should be 1, other should be 0
          expect(lt + gte).toBe(1)
        }),
        { numRuns: 50 }
      )
    })

    it('> and <= are complementary', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer(), fc.integer(), async (a, b) => {
          const gt = await evalExpr(`${a} > ${b}`, rt)
          const lte = await evalExpr(`${a} <= ${b}`, rt)
          expect(gt + lte).toBe(1)
        }),
        { numRuns: 50 }
      )
    })

    it('== and != are complementary', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer(), fc.integer(), async (a, b) => {
          const eq = await evalExpr(`${a} == ${b}`, rt)
          const neq = await evalExpr(`${a} != ${b}`, rt)
          expect(eq + neq).toBe(1)
        }),
        { numRuns: 50 }
      )
    })

    it('equality is reflexive: a == a', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer(), async a => {
          const result = await evalExpr(`${a} == ${a}`, rt)
          expect(result).toBe(1)
        }),
        { numRuns: 50 }
      )
    })

    it('trichotomy: exactly one of a < b, a == b, a > b is true', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer(), fc.integer(), async (a, b) => {
          const lt = await evalExpr(`${a} < ${b}`, rt)
          const eq = await evalExpr(`${a} == ${b}`, rt)
          const gt = await evalExpr(`${a} > ${b}`, rt)
          expect(lt + eq + gt).toBe(1)
        }),
        { numRuns: 50 }
      )
    })
  })

  describe('Logical Properties', () => {
    it('&& is commutative for boolean values', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.boolean(), fc.boolean(), async (a, b) => {
          const aNum = a ? 1 : 0
          const bNum = b ? 1 : 0
          const result1 = await evalExpr(`${aNum} && ${bNum}`, rt)
          const result2 = await evalExpr(`${bNum} && ${aNum}`, rt)
          expect(result1).toBe(result2)
        }),
        { numRuns: 10 }
      )
    })

    it('|| is commutative for boolean values', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.boolean(), fc.boolean(), async (a, b) => {
          const aNum = a ? 1 : 0
          const bNum = b ? 1 : 0
          const result1 = await evalExpr(`${aNum} || ${bNum}`, rt)
          const result2 = await evalExpr(`${bNum} || ${aNum}`, rt)
          expect(result1).toBe(result2)
        }),
        { numRuns: 10 }
      )
    })

    it('De Morgan: !(a && b) === !a || !b', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.boolean(), fc.boolean(), async (a, b) => {
          const aNum = a ? 1 : 0
          const bNum = b ? 1 : 0
          const result1 = await evalExpr(`!(${aNum} && ${bNum})`, rt)
          const result2 = await evalExpr(`!${aNum} || !${bNum}`, rt)
          expect(result1).toBe(result2)
        }),
        { numRuns: 10 }
      )
    })
  })

  describe('Ternary Operator Properties', () => {
    it('ternary with true condition returns first branch', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 1, max: 100 }), async (a, b) => {
          const result = await evalExpr(`1 ? ${a} : ${b}`, rt)
          expect(result).toBe(a)
        }),
        { numRuns: 20 }
      )
    })

    it('ternary with false condition returns second branch', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 1, max: 100 }), async (a, b) => {
          const result = await evalExpr(`0 ? ${a} : ${b}`, rt)
          expect(result).toBe(b)
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('Bitwise Operator Properties', () => {
    it('bitwise AND is commutative: a & b === b & a', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), async (a, b) => {
          const result1 = await evalExpr(`${a} & ${b}`, rt)
          const result2 = await evalExpr(`${b} & ${a}`, rt)
          expect(result1).toBe(result2)
        }),
        { numRuns: 30 }
      )
    })

    it('bitwise OR is commutative: a | b === b | a', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), async (a, b) => {
          const result1 = await evalExpr(`${a} | ${b}`, rt)
          const result2 = await evalExpr(`${b} | ${a}`, rt)
          expect(result1).toBe(result2)
        }),
        { numRuns: 30 }
      )
    })

    it('bitwise XOR is commutative: a ^ b === b ^ a', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), async (a, b) => {
          const result1 = await evalExpr(`${a} ^ ${b}`, rt)
          const result2 = await evalExpr(`${b} ^ ${a}`, rt)
          expect(result1).toBe(result2)
        }),
        { numRuns: 30 }
      )
    })

    it('a & a === a (idempotent)', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 255 }), async a => {
          const result = await evalExpr(`${a} & ${a}`, rt)
          expect(result).toBe(a)
        }),
        { numRuns: 30 }
      )
    })

    it('a | a === a (idempotent)', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 255 }), async a => {
          const result = await evalExpr(`${a} | ${a}`, rt)
          expect(result).toBe(a)
        }),
        { numRuns: 30 }
      )
    })

    it('a ^ a === 0 (self XOR is zero)', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 255 }), async a => {
          const result = await evalExpr(`${a} ^ ${a}`, rt)
          expect(result).toBe(0)
        }),
        { numRuns: 30 }
      )
    })

    it('left shift doubles value: a << 1 === a * 2', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 1000 }), async a => {
          const shift = await evalExpr(`${a} << 1`, rt)
          const mult = await evalExpr(`${a} * 2`, rt)
          expect(shift).toBe(mult)
        }),
        { numRuns: 30 }
      )
    })

    it('right shift halves value (floor): a >> 1 === int(a / 2)', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 1000 }), async a => {
          const shift = await evalExpr(`${a} >> 1`, rt)
          const div = Math.floor(a / 2)
          expect(shift).toBe(div)
        }),
        { numRuns: 30 }
      )
    })
  })

  describe('String Comparison Properties', () => {
    it('eq is reflexive: string equals itself', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(
          fc.string({ unit: fc.constantFrom(...'abcdefghij'.split('')), minLength: 1, maxLength: 8 }),
          async s => {
            const result = await evalExpr(`"${s}" eq "${s}"`, rt)
            expect(result).toBe(1)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('eq and ne are complementary', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(
          fc.string({ unit: fc.constantFrom(...'abcdefghij'.split('')), minLength: 1, maxLength: 5 }),
          fc.string({ unit: fc.constantFrom(...'abcdefghij'.split('')), minLength: 1, maxLength: 5 }),
          async (a, b) => {
            const eq = await evalExpr(`"${a}" eq "${b}"`, rt)
            const ne = await evalExpr(`"${a}" ne "${b}"`, rt)
            expect(eq + ne).toBe(1)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('string comparison trichotomy: exactly one of lt, eq, gt is true', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(
          fc.string({ unit: fc.constantFrom(...'abcdefghij'.split('')), minLength: 1, maxLength: 5 }),
          fc.string({ unit: fc.constantFrom(...'abcdefghij'.split('')), minLength: 1, maxLength: 5 }),
          async (a, b) => {
            const lt = await evalExpr(`"${a}" lt "${b}"`, rt)
            const eq = await evalExpr(`"${a}" eq "${b}"`, rt)
            const gt = await evalExpr(`"${a}" gt "${b}"`, rt)
            expect(lt + eq + gt).toBe(1)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('lt and ge are complementary', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(
          fc.string({ unit: fc.constantFrom(...'abcdefghij'.split('')), minLength: 1, maxLength: 5 }),
          fc.string({ unit: fc.constantFrom(...'abcdefghij'.split('')), minLength: 1, maxLength: 5 }),
          async (a, b) => {
            const lt = await evalExpr(`"${a}" lt "${b}"`, rt)
            const ge = await evalExpr(`"${a}" ge "${b}"`, rt)
            expect(lt + ge).toBe(1)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('gt and le are complementary', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(
          fc.string({ unit: fc.constantFrom(...'abcdefghij'.split('')), minLength: 1, maxLength: 5 }),
          fc.string({ unit: fc.constantFrom(...'abcdefghij'.split('')), minLength: 1, maxLength: 5 }),
          async (a, b) => {
            const gt = await evalExpr(`"${a}" gt "${b}"`, rt)
            const le = await evalExpr(`"${a}" le "${b}"`, rt)
            expect(gt + le).toBe(1)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('string comparison is antisymmetric: a lt b implies b gt a', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(
          fc.string({ unit: fc.constantFrom(...'abcdefghij'.split('')), minLength: 1, maxLength: 5 }),
          fc.string({ unit: fc.constantFrom(...'abcdefghij'.split('')), minLength: 1, maxLength: 5 }),
          async (a, b) => {
            const aLtB = await evalExpr(`"${a}" lt "${b}"`, rt)
            const bGtA = await evalExpr(`"${b}" gt "${a}"`, rt)
            expect(aLtB).toBe(bGtA)
          }
        ),
        { numRuns: 20 }
      )
    })
  })

  describe('List Operator Properties', () => {
    it('element in list returns 1', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(
          fc.string({ unit: fc.constantFrom(...'abcdef'.split('')), minLength: 1, maxLength: 4 }),
          async elem => {
            const result = await evalExpr(`"${elem}" in {${elem} other stuff}`, rt)
            expect(result).toBe(1)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('element not in list returns 0', async () => {
      const rt = createRuntime()

      const result = await evalExpr('"xyz" in {a b c}', rt)
      expect(result).toBe(0)
    })

    it('ni is complement of in', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(
          fc.string({ unit: fc.constantFrom(...'abc'.split('')), minLength: 1, maxLength: 3 }),
          async elem => {
            const inList = await evalExpr(`"${elem}" in {a b c d}`, rt)
            const notIn = await evalExpr(`"${elem}" ni {a b c d}`, rt)
            expect(inList + notIn).toBe(1)
          }
        ),
        { numRuns: 20 }
      )
    })
  })

  describe('Lazy Evaluation Properties', () => {
    it('ternary does not evaluate false branch when condition is true', async () => {
      const rt = createRuntime()
      rt.register('error', async args => {
        throw new Error(args[0])
      })

      // Should not throw because false branch is not evaluated
      const result = await evalExpr('1 ? 42 : [error "should not evaluate"]', rt)
      expect(result).toBe(42)
    })

    it('ternary does not evaluate true branch when condition is false', async () => {
      const rt = createRuntime()
      rt.register('error', async args => {
        throw new Error(args[0])
      })

      // Should not throw because true branch is not evaluated
      const result = await evalExpr('0 ? [error "should not evaluate"] : 42', rt)
      expect(result).toBe(42)
    })

    it('|| does not evaluate right operand when left is truthy', async () => {
      const rt = createRuntime()
      rt.register('error', async args => {
        throw new Error(args[0])
      })

      // Should not throw because right side is not evaluated
      const result = await evalExpr('1 || [error "should not evaluate"]', rt)
      expect(result).toBe(1)
    })

    it('|| evaluates right operand when left is falsy', async () => {
      const rt = createRuntime()
      rt.register('error', async args => {
        throw new Error(args[0])
      })

      // Should throw because right side is evaluated
      await expect(expr('0 || [error "this should throw"]', rt)).rejects.toThrow('this should throw')
    })

    it('&& does not evaluate right operand when left is falsy', async () => {
      const rt = createRuntime()
      rt.register('error', async args => {
        throw new Error(args[0])
      })

      // Should not throw because right side is not evaluated
      const result = await evalExpr('0 && [error "should not evaluate"]', rt)
      expect(result).toBe(0)
    })

    it('&& evaluates right operand when left is truthy', async () => {
      const rt = createRuntime()
      rt.register('error', async args => {
        throw new Error(args[0])
      })

      // Should throw because right side is evaluated
      await expect(expr('1 && [error "this should throw"]', rt)).rejects.toThrow('this should throw')
    })

    it('nested lazy evaluation works correctly', async () => {
      const rt = createRuntime()
      rt.register('error', async args => {
        throw new Error(args[0])
      })

      // Complex nested case - should not throw because false branches are not evaluated
      const r1 = await evalExpr('1 ? (0 || 1) : [error "no"]', rt)
      expect(r1).toBe(1)
      const r2 = await evalExpr('0 ? [error "no"] : (1 && 1)', rt)
      expect(r2).toBe(1)
      const r3 = await evalExpr('1 && (0 ? [error "no"] : 1)', rt)
      expect(r3).toBe(1)
    })
  })

  describe('Math Function Properties', () => {
    it('abs is always non-negative', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: -10000, max: 10000 }), async a => {
          const result = await evalExpr(`abs(${a})`, rt)
          expect(result).toBeGreaterThanOrEqual(0)
        }),
        { numRuns: 50 }
      )
    })

    it('abs(a) === abs(-a)', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: -10000, max: 10000 }), async a => {
          const result1 = await evalExpr(`abs(${a})`, rt)
          const result2 = await evalExpr(`abs(${-a})`, rt)
          expect(result1).toBe(result2)
        }),
        { numRuns: 50 }
      )
    })

    it('max(a, b) >= a and max(a, b) >= b', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer(), fc.integer(), async (a, b) => {
          const result = await evalExpr(`max(${a}, ${b})`, rt)
          expect(result).toBeGreaterThanOrEqual(a)
          expect(result).toBeGreaterThanOrEqual(b)
        }),
        { numRuns: 50 }
      )
    })

    it('min(a, b) <= a and min(a, b) <= b', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer(), fc.integer(), async (a, b) => {
          const result = await evalExpr(`min(${a}, ${b})`, rt)
          expect(result).toBeLessThanOrEqual(a)
          expect(result).toBeLessThanOrEqual(b)
        }),
        { numRuns: 50 }
      )
    })

    it('pow(a, 1) === a', async () => {
      const rt = createRuntime()

      fc.assert(
        fc.asyncProperty(fc.integer({ min: -100, max: 100 }), async a => {
          const result = await evalExpr(`pow(${a}, 1)`, rt)
          expect(result).toBe(a)
        }),
        { numRuns: 20 }
      )
    })
  })
})
