import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { TT, tokenize } from '../src/index.js'

/**
 * Property-based tests for the Tcl tokenizer
 */

describe('Tokenizer Properties', () => {
  describe('Safety Properties', () => {
    it('always produces EOF token on valid input', () => {
      // Use simple alphanumeric strings that won't cause parsing issues
      fc.assert(
        fc.property(
          fc.string({ unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 \n'.split('')) }),
          input => {
            const tokens = [...tokenize(input)]
            expect(tokens[tokens.length - 1].t).toBe(TT.EOF)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('handles nested braces up to reasonable depth', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), depth => {
          const nested = '{'.repeat(depth) + 'x' + '}'.repeat(depth)
          const tokens = [...tokenize(nested)]
          expect(tokens.some(t => t.t === TT.BRC)).toBe(true)
        }),
        { numRuns: 10 }
      )
    })

    it('handles nested brackets up to reasonable depth', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), depth => {
          const nested = '['.repeat(depth) + 'x' + ']'.repeat(depth)
          const tokens = [...tokenize(nested)]
          expect(tokens.some(t => t.t === TT.CMD)).toBe(true)
        }),
        { numRuns: 10 }
      )
    })
  })

  describe('Structural Properties', () => {
    it('balanced braces produce BRC tokens', () => {
      const arbContent = fc.string({ unit: fc.constantFrom(...'abc 123'.split('')), maxLength: 20 })

      fc.assert(
        fc.property(arbContent, content => {
          const input = `{${content}}`
          const tokens = [...tokenize(input)]
          const brcTokens = tokens.filter(t => t.t === TT.BRC)
          expect(brcTokens.length).toBe(1)
          expect(brcTokens[0].v).toBe(content)
        }),
        { numRuns: 30 }
      )
    })

    it('variable references produce VAR tokens', () => {
      const arbVarName = fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,10}$/).filter(s => s.length > 0)

      fc.assert(
        fc.property(arbVarName, name => {
          const tokens = [...tokenize(`$${name}`)]
          const varTokens = tokens.filter(t => t.t === TT.VAR)
          expect(varTokens.length).toBe(1)
          expect(varTokens[0].v).toBe(name)
        }),
        { numRuns: 30 }
      )
    })

    it('command substitutions produce CMD tokens', () => {
      const arbSimpleCmd = fc.string({ unit: fc.constantFrom(...'abc 123'.split('')), maxLength: 20 })

      fc.assert(
        fc.property(arbSimpleCmd, cmd => {
          const tokens = [...tokenize(`[${cmd}]`)]
          const cmdTokens = tokens.filter(t => t.t === TT.CMD)
          expect(cmdTokens.length).toBe(1)
          expect(cmdTokens[0].v).toBe(cmd)
        }),
        { numRuns: 30 }
      )
    })
  })

  describe('Error Handling Properties', () => {
    it('unbalanced opening brace throws error', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 5 }), count => {
          const unbalanced = '{'.repeat(count) + 'x'
          expect(() => [...tokenize(unbalanced)]).toThrow()
        }),
        { numRuns: 5 }
      )
    })

    it('unbalanced opening bracket throws error', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 5 }), count => {
          const unbalanced = '['.repeat(count) + 'x'
          expect(() => [...tokenize(unbalanced)]).toThrow()
        }),
        { numRuns: 5 }
      )
    })
  })

  describe('Whitespace Properties', () => {
    it('multiple spaces collapse to single SEP', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), fc.integer({ min: 1, max: 10 }), (spaces1, spaces2) => {
          const input = 'a' + ' '.repeat(spaces1) + 'b' + ' '.repeat(spaces2) + 'c'
          const tokens = [...tokenize(input)]
          const sepTokens = tokens.filter(t => t.t === TT.SEP)
          expect(sepTokens.length).toBe(2)
        }),
        { numRuns: 20 }
      )
    })

    it('newlines produce EOL tokens', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 5 }), lines => {
          const input = Array(lines).fill('cmd').join('\n')
          const tokens = [...tokenize(input)]
          const eolTokens = tokens.filter(t => t.t === TT.EOL)
          expect(eolTokens.length).toBeGreaterThanOrEqual(lines - 1)
        }),
        { numRuns: 10 }
      )
    })
  })
})
