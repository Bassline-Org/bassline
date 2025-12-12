import { describe, it, expect } from 'vitest'
import { matchesPattern } from '../src/match.js'

describe('matchesPattern', () => {
  describe('string patterns (regex)', () => {
    it('matches exact strings with ^ and $', () => {
      expect(matchesPattern('^hello$', 'hello')).toBe(true)
      expect(matchesPattern('^hello$', 'hello world')).toBe(false)
    })

    it('matches prefix with ^', () => {
      expect(matchesPattern('^bl:///', 'bl:///data/users')).toBe(true)
      expect(matchesPattern('^bl:///', 'http://example.com')).toBe(false)
    })

    it('matches suffix with $', () => {
      expect(matchesPattern('.json$', 'file.json')).toBe(true)
      expect(matchesPattern('.json$', 'file.txt')).toBe(false)
    })

    it('matches any with .*', () => {
      expect(matchesPattern('.*', 'anything')).toBe(true)
      expect(matchesPattern('.*', '')).toBe(true)
    })

    it('matches complex patterns', () => {
      expect(matchesPattern('^bl:///data/.*', 'bl:///data/users/alice')).toBe(true)
      expect(matchesPattern('^bl:///data/.*', 'bl:///other/path')).toBe(false)
    })
  })

  describe('RegExp patterns', () => {
    it('accepts RegExp objects', () => {
      expect(matchesPattern(/^hello/, 'hello world')).toBe(true)
      expect(matchesPattern(/\d+/, 'user123')).toBe(true)
    })
  })

  describe('object patterns', () => {
    it('matches nested properties', () => {
      const pattern = { uri: '^bl:///data/.*' }
      const target = { uri: 'bl:///data/users/alice', other: 'ignored' }
      expect(matchesPattern(pattern, target)).toBe(true)
    })

    it('matches deeply nested properties', () => {
      const pattern = {
        headers: { type: '^cell$' },
      }
      const target = {
        headers: { type: 'cell', other: 'stuff' },
        body: 'ignored',
      }
      expect(matchesPattern(pattern, target)).toBe(true)
    })

    it('fails if any property does not match', () => {
      const pattern = {
        uri: '^bl:///data/.*',
        headers: { type: '^cell$' },
      }
      const target = {
        uri: 'bl:///data/users',
        headers: { type: 'document' },
      }
      expect(matchesPattern(pattern, target)).toBe(false)
    })

    it('fails if target is missing properties', () => {
      const pattern = { uri: '.*' }
      const target = {}
      expect(matchesPattern(pattern, target)).toBe(false)
    })
  })

  describe('primitive value patterns', () => {
    it('matches boolean values with strict equality', () => {
      expect(matchesPattern(true, true)).toBe(true)
      expect(matchesPattern(true, false)).toBe(false)
      expect(matchesPattern(false, false)).toBe(true)
      expect(matchesPattern(false, true)).toBe(false)
    })

    it('matches number values with strict equality', () => {
      expect(matchesPattern(42, 42)).toBe(true)
      expect(matchesPattern(42, 43)).toBe(false)
      expect(matchesPattern(0, 0)).toBe(true)
      expect(matchesPattern(-1, -1)).toBe(true)
    })

    it('matches null with strict equality', () => {
      expect(matchesPattern(null, null)).toBe(true)
      expect(matchesPattern(null, undefined)).toBe(false)
      expect(matchesPattern(null, false)).toBe(false)
    })

    it('matches undefined with strict equality', () => {
      expect(matchesPattern(undefined, undefined)).toBe(true)
      expect(matchesPattern(undefined, null)).toBe(false)
    })

    it('matches primitive values in object patterns', () => {
      const pattern = { headers: { type: 'bl:///types/cell-value', changed: true } }
      const target = { headers: { type: 'bl:///types/cell-value', changed: true } }
      expect(matchesPattern(pattern, target)).toBe(true)
    })

    it('fails when primitive values do not match in object patterns', () => {
      const pattern = { headers: { type: 'bl:///types/cell-value', changed: true } }
      const target1 = { headers: { type: 'bl:///types/cell-value', changed: false } }
      const target2 = { headers: { type: 'bl:///types/cell-value' } }
      expect(matchesPattern(pattern, target1)).toBe(false)
      expect(matchesPattern(pattern, target2)).toBe(false)
    })

    it('matches mixed primitive and string patterns', () => {
      const pattern = {
        headers: {
          type: '^cell$',
          count: 5,
          active: true,
        },
      }
      const target = {
        headers: {
          type: 'cell',
          count: 5,
          active: true,
        },
      }
      expect(matchesPattern(pattern, target)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('returns false for null pattern against non-null', () => {
      expect(matchesPattern(null, 'hello')).toBe(false)
      expect(matchesPattern(null, 42)).toBe(false)
      expect(matchesPattern(null, true)).toBe(false)
    })

    it('returns false for null target with object pattern', () => {
      expect(matchesPattern({ uri: '.*' }, null)).toBe(false)
    })

    it('returns false when matching string pattern against non-string', () => {
      expect(matchesPattern('hello', 42)).toBe(false)
      expect(matchesPattern('hello', {})).toBe(false)
    })
  })
})
