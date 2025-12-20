import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { Runtime, std, dictCmd } from '../src/index.js'

/**
 * Property-based tests for Tcl dict operations
 */

function createRuntime() {
  const rt = new Runtime()
  for (const [n, fn] of Object.entries(std)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(dictCmd)) rt.register(n, fn)
  return rt
}

// Arbitrary for safe keys (no special Tcl chars)
const arbKey = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'.split('')),
  minLength: 1,
  maxLength: 8,
})

// Arbitrary for safe values
const arbValue = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
  minLength: 1,
  maxLength: 10,
})

// Arbitrary for key-value pairs
const arbKeyValue = fc.tuple(arbKey, arbValue)

// Arbitrary for small dict (list of key-value pairs)
const arbDict = fc.array(arbKeyValue, { minLength: 0, maxLength: 5 })

// Format dict as Tcl dict create args
function formatDictArgs(pairs) {
  return pairs.map(([k, v]) => `{${k}} {${v}}`).join(' ')
}

describe('Dict Properties', () => {
  describe('Size Properties', () => {
    it('dict size returns correct count', () => {
      fc.assert(
        fc.property(arbDict, pairs => {
          const rt = createRuntime()
          const args = formatDictArgs(pairs)

          // Create dict
          rt.run(`set d [dict create ${args}]`)
          const size = Number(rt.run('dict size $d'))

          // Size should equal number of unique keys
          const uniqueKeys = new Set(pairs.map(([k]) => k))
          expect(size).toBe(uniqueKeys.size)
        }),
        { numRuns: 20 }
      )
    })

    it('dict set increases size by one for new key', () => {
      fc.assert(
        fc.property(arbDict, arbKey, arbValue, (pairs, newKey, value) => {
          const rt = createRuntime()
          const args = formatDictArgs(pairs)

          // Filter out the new key from existing pairs
          const filteredPairs = pairs.filter(([k]) => k !== newKey)
          const filteredArgs = formatDictArgs(filteredPairs)

          rt.run(`set d [dict create ${filteredArgs}]`)
          const sizeBefore = Number(rt.run('dict size $d'))

          rt.run(`dict set d {${newKey}} {${value}}`)
          const sizeAfter = Number(rt.run('dict size $d'))

          expect(sizeAfter).toBe(sizeBefore + 1)
        }),
        { numRuns: 15 }
      )
    })

    it('dict unset decreases size by one', () => {
      fc.assert(
        fc.property(arbDict, pairs => {
          fc.pre(pairs.length > 0)
          const rt = createRuntime()
          const args = formatDictArgs(pairs)

          rt.run(`set d [dict create ${args}]`)
          const sizeBefore = Number(rt.run('dict size $d'))

          // Unset first key
          const keyToRemove = pairs[0][0]
          rt.run(`dict unset d {${keyToRemove}}`)
          const sizeAfter = Number(rt.run('dict size $d'))

          expect(sizeAfter).toBe(sizeBefore - 1)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Get/Set Properties', () => {
    it('dict get returns what was set', () => {
      fc.assert(
        fc.property(arbKey, arbValue, (key, value) => {
          const rt = createRuntime()

          rt.run(`set d [dict create {${key}} {${value}}]`)
          const result = rt.run(`dict get $d {${key}}`)

          expect(result).toBe(value)
        }),
        { numRuns: 20 }
      )
    })

    it('dict set overwrites existing value', () => {
      fc.assert(
        fc.property(arbKey, arbValue, arbValue, (key, val1, val2) => {
          const rt = createRuntime()

          rt.run(`set d [dict create {${key}} {${val1}}]`)
          rt.run(`dict set d {${key}} {${val2}}`)
          const result = rt.run(`dict get $d {${key}}`)

          expect(result).toBe(val2)
        }),
        { numRuns: 20 }
      )
    })

    it('dict set maintains other keys', () => {
      fc.assert(
        fc.property(arbKey, arbKey, arbValue, arbValue, arbValue, (key1, key2, val1, val2, newVal) => {
          fc.pre(key1 !== key2)
          const rt = createRuntime()

          rt.run(`set d [dict create {${key1}} {${val1}} {${key2}} {${val2}}]`)
          rt.run(`dict set d {${key1}} {${newVal}}`)

          // key2 value should be unchanged
          const result = rt.run(`dict get $d {${key2}}`)
          expect(result).toBe(val2)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Exists Properties', () => {
    it('dict exists returns 1 for existing key', () => {
      fc.assert(
        fc.property(arbKey, arbValue, (key, value) => {
          const rt = createRuntime()

          rt.run(`set d [dict create {${key}} {${value}}]`)
          const result = rt.run(`dict exists $d {${key}}`)

          expect(result).toBe('1')
        }),
        { numRuns: 15 }
      )
    })

    it('dict exists returns 0 for non-existent key', () => {
      fc.assert(
        fc.property(arbKey, arbKey, arbValue, (existingKey, missingKey, value) => {
          fc.pre(existingKey !== missingKey)
          const rt = createRuntime()

          rt.run(`set d [dict create {${existingKey}} {${value}}]`)
          const result = rt.run(`dict exists $d {${missingKey}}`)

          expect(result).toBe('0')
        }),
        { numRuns: 15 }
      )
    })

    it('dict exists returns 0 after unset', () => {
      fc.assert(
        fc.property(arbKey, arbValue, (key, value) => {
          const rt = createRuntime()

          rt.run(`set d [dict create {${key}} {${value}}]`)
          rt.run(`dict unset d {${key}}`)
          const result = rt.run(`dict exists $d {${key}}`)

          expect(result).toBe('0')
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Keys/Values Properties', () => {
    it('dict keys count equals dict size', () => {
      fc.assert(
        fc.property(arbDict, pairs => {
          const rt = createRuntime()
          const args = formatDictArgs(pairs)

          rt.run(`set d [dict create ${args}]`)
          const size = Number(rt.run('dict size $d'))
          const keys = rt.run('dict keys $d')
          const keyCount = keys ? keys.split(/\s+/).length : 0

          expect(keyCount).toBe(size)
        }),
        { numRuns: 15 }
      )
    })

    it('dict values count equals dict size', () => {
      fc.assert(
        fc.property(arbDict, pairs => {
          const rt = createRuntime()
          const args = formatDictArgs(pairs)

          rt.run(`set d [dict create ${args}]`)
          const size = Number(rt.run('dict size $d'))
          const values = rt.run('dict values $d')
          const valueCount = values ? values.split(/\s+/).length : 0

          expect(valueCount).toBe(size)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Merge Properties', () => {
    it('merge with empty dict is identity', () => {
      fc.assert(
        fc.property(arbKey, arbValue, (key, value) => {
          const rt = createRuntime()

          rt.run(`set d1 [dict create {${key}} {${value}}]`)
          rt.run('set d2 [dict create]')
          rt.run('set merged [dict merge $d1 $d2]')

          const result = rt.run('dict get $merged {' + key + '}')
          expect(result).toBe(value)
        }),
        { numRuns: 15 }
      )
    })

    it('merge combines all keys', () => {
      fc.assert(
        fc.property(arbKey, arbKey, arbValue, arbValue, (key1, key2, val1, val2) => {
          fc.pre(key1 !== key2)
          const rt = createRuntime()

          rt.run(`set d1 [dict create {${key1}} {${val1}}]`)
          rt.run(`set d2 [dict create {${key2}} {${val2}}]`)
          rt.run('set merged [dict merge $d1 $d2]')

          const size = Number(rt.run('dict size $merged'))
          expect(size).toBe(2)

          expect(rt.run(`dict get $merged {${key1}}`)).toBe(val1)
          expect(rt.run(`dict get $merged {${key2}}`)).toBe(val2)
        }),
        { numRuns: 15 }
      )
    })

    it('merge last dict wins for duplicate keys', () => {
      fc.assert(
        fc.property(arbKey, arbValue, arbValue, (key, val1, val2) => {
          const rt = createRuntime()

          rt.run(`set d1 [dict create {${key}} {${val1}}]`)
          rt.run(`set d2 [dict create {${key}} {${val2}}]`)
          rt.run('set merged [dict merge $d1 $d2]')

          const result = rt.run(`dict get $merged {${key}}`)
          expect(result).toBe(val2)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Incr Properties', () => {
    it('dict incr adds to numeric value', () => {
      fc.assert(
        fc.property(
          arbKey,
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 1, max: 10 }),
          (key, initial, increment) => {
            const rt = createRuntime()

            rt.run(`set d [dict create {${key}} ${initial}]`)
            rt.run(`dict incr d {${key}} ${increment}`)

            const result = Number(rt.run(`dict get $d {${key}}`))
            expect(result).toBe(initial + increment)
          }
        ),
        { numRuns: 15 }
      )
    })

    it('dict incr with no increment adds 1', () => {
      fc.assert(
        fc.property(arbKey, fc.integer({ min: 0, max: 50 }), (key, initial) => {
          const rt = createRuntime()

          rt.run(`set d [dict create {${key}} ${initial}]`)
          rt.run(`dict incr d {${key}}`)

          const result = Number(rt.run(`dict get $d {${key}}`))
          expect(result).toBe(initial + 1)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Replace/Remove Properties', () => {
    it('dict replace returns new dict with value changed', () => {
      fc.assert(
        fc.property(arbKey, arbValue, arbValue, (key, val1, val2) => {
          const rt = createRuntime()

          rt.run(`set d [dict create {${key}} {${val1}}]`)
          rt.run(`set d2 [dict replace $d {${key}} {${val2}}]`)

          // New dict has new value
          expect(rt.run(`dict get $d2 {${key}}`)).toBe(val2)
          // Original unchanged
          expect(rt.run(`dict get $d {${key}}`)).toBe(val1)
        }),
        { numRuns: 15 }
      )
    })

    it('dict remove returns new dict without key', () => {
      fc.assert(
        fc.property(arbKey, arbKey, arbValue, arbValue, (key1, key2, val1, val2) => {
          fc.pre(key1 !== key2)
          const rt = createRuntime()

          rt.run(`set d [dict create {${key1}} {${val1}} {${key2}} {${val2}}]`)
          rt.run(`set d2 [dict remove $d {${key1}}]`)

          // New dict missing key1
          expect(rt.run(`dict exists $d2 {${key1}}`)).toBe('0')
          // But has key2
          expect(rt.run(`dict exists $d2 {${key2}}`)).toBe('1')
          // Original unchanged
          expect(rt.run(`dict exists $d {${key1}}`)).toBe('1')
        }),
        { numRuns: 15 }
      )
    })
  })
})
