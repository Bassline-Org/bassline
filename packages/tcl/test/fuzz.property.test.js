import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { Runtime, std, createShell } from '../src/index.js'

/**
 * Fuzz/chaos testing for Tcl runtime - ensures it doesn't crash on random input
 */

// Runtime without loop commands to prevent infinite loops on random input
function createSafeRuntime() {
  const rt = new Runtime()
  const safeStd = { ...std }
  delete safeStd.while
  delete safeStd.for
  delete safeStd.foreach
  for (const [n, fn] of Object.entries(safeStd)) rt.register(n, fn)
  return rt
}

describe('Fuzz Testing', () => {
  describe('Random Input', () => {
    it('handles random alphanumeric strings', () => {
      fc.assert(
        fc.property(
          fc.string({ unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 \n'.split('')), maxLength: 30 }),
          input => {
            const rt = createSafeRuntime()
            try {
              rt.run(input)
            } catch (err) {
              expect(err).toBeInstanceOf(Error)
            }
            return true
          }
        ),
        { numRuns: 20 }
      )
    })

    it('handles random braces', () => {
      fc.assert(
        fc.property(fc.array(fc.constantFrom('{', '}', 'x', ' '), { minLength: 1, maxLength: 15 }), chars => {
          const rt = createSafeRuntime()
          try {
            rt.run(chars.join(''))
          } catch (err) {
            expect(err).toBeInstanceOf(Error)
          }
          return true
        }),
        { numRuns: 15 }
      )
    })

    it('handles random brackets', () => {
      fc.assert(
        fc.property(fc.array(fc.constantFrom('[', ']', 'x', ' '), { minLength: 1, maxLength: 15 }), chars => {
          const rt = createSafeRuntime()
          try {
            rt.run(chars.join(''))
          } catch (err) {
            expect(err).toBeInstanceOf(Error)
          }
          return true
        }),
        { numRuns: 15 }
      )
    })

    it('handles random dollar signs', () => {
      fc.assert(
        fc.property(fc.array(fc.constantFrom('$', 'x', ' ', '{', '}'), { minLength: 1, maxLength: 15 }), chars => {
          const rt = createSafeRuntime()
          try {
            rt.run(chars.join(''))
          } catch (err) {
            expect(err).toBeInstanceOf(Error)
          }
          return true
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Grammar-based', () => {
    it('random set commands', () => {
      fc.assert(
        fc.property(
          fc.string({ unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'.split('')), minLength: 1, maxLength: 8 }),
          fc.string({
            unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
            minLength: 1,
            maxLength: 10,
          }),
          (name, value) => {
            const rt = createSafeRuntime()
            try {
              rt.run(`set ${name} {${value}}`)
            } catch (err) {
              expect(err).toBeInstanceOf(Error)
            }
            return true
          }
        ),
        { numRuns: 15 }
      )
    })

    it('random expr commands', () => {
      fc.assert(
        fc.property(fc.integer({ min: -50, max: 50 }), fc.integer({ min: -50, max: 50 }), (a, b) => {
          const rt = createSafeRuntime()
          try {
            rt.run(`expr {${a} + ${b}}`)
          } catch (err) {
            expect(err).toBeInstanceOf(Error)
          }
          return true
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Shell', () => {
    it('handles malformed commands gracefully', async () => {
      const shell = createShell()
      const badInputs = ['{unclosed', '[unclosed', 'nonexistent', 'expr {1 +}', ']orphan']
      for (const input of badInputs) {
        const result = await shell.put({ path: '/eval' }, input)
        expect(result.headers).toBeDefined()
      }
    })
  })

  describe('Stress', () => {
    it('handles rapid variable creation', () => {
      const rt = createSafeRuntime()
      for (let i = 0; i < 50; i++) rt.run(`set v${i} ${i}`)
      expect(rt.getVar('v0')).toBe('0')
      expect(rt.getVar('v49')).toBe('49')
    })

    it('handles nested if statements', () => {
      const rt = createSafeRuntime()
      const depth = 10
      let script = 'set x 0\n'
      for (let i = 0; i < depth; i++) script += 'if {1} {\n'
      script += 'set x done\n'
      for (let i = 0; i < depth; i++) script += '}\n'
      rt.run(script)
      expect(rt.getVar('x')).toBe('done')
    })
  })
})
