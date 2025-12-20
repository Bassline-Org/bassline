import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { Runtime, std, list } from '../src/index.js'

/**
 * Property-based tests for Tcl list operations
 */

function createRuntime() {
  const rt = new Runtime()
  for (const [n, fn] of Object.entries(std)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(list)) rt.register(n, fn)
  return rt
}

// Arbitrary for safe list elements (no special Tcl chars)
const arbElement = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
  minLength: 1,
  maxLength: 8,
})

// Arbitrary for small arrays of elements
const arbList = fc.array(arbElement, { minLength: 0, maxLength: 10 })

// Format array as Tcl list
function formatList(arr) {
  return arr.map(s => `{${s}}`).join(' ')
}

// Parse Tcl list result back to array
function parseList(str) {
  if (!str || str.trim() === '') return []
  // Simple parsing - split on space, remove braces
  return str.split(/\s+/).map(s => s.replace(/^\{|\}$/g, ''))
}

describe('List Properties', () => {
  describe('Length Properties', () => {
    it('llength returns correct count', () => {
      fc.assert(
        fc.property(arbList, arr => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          const len = Number(rt.run(`llength {${listStr}}`))
          expect(len).toBe(arr.length)
        }),
        { numRuns: 20 }
      )
    })

    it('lappend increases length by one', () => {
      fc.assert(
        fc.property(arbList, arbElement, (arr, elem) => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          rt.run(`set mylist {${listStr}}`)
          rt.run(`lappend mylist {${elem}}`)

          const newLen = Number(rt.run('llength $mylist'))
          expect(newLen).toBe(arr.length + 1)
        }),
        { numRuns: 20 }
      )
    })

    it('concat preserves total length', () => {
      fc.assert(
        fc.property(arbList, arbList, (arr1, arr2) => {
          const rt = createRuntime()
          const list1 = formatList(arr1)
          const list2 = formatList(arr2)

          const result = rt.run(`concat {${list1}} {${list2}}`)
          const resultLen = Number(rt.run(`llength {${result}}`))

          expect(resultLen).toBe(arr1.length + arr2.length)
        }),
        { numRuns: 15 }
      )
    })

    it('lreverse preserves length', () => {
      fc.assert(
        fc.property(arbList, arr => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          const reversed = rt.run(`lreverse {${listStr}}`)
          const reversedLen = Number(rt.run(`llength {${reversed}}`))

          expect(reversedLen).toBe(arr.length)
        }),
        { numRuns: 20 }
      )
    })

    it('lsort preserves length', () => {
      fc.assert(
        fc.property(arbList, arr => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          const sorted = rt.run(`lsort {${listStr}}`)
          const sortedLen = Number(rt.run(`llength {${sorted}}`))

          expect(sortedLen).toBe(arr.length)
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('Indexing Properties', () => {
    it('lindex returns correct element', () => {
      fc.assert(
        fc.property(arbList, fc.nat(), (arr, idx) => {
          fc.pre(arr.length > 0)
          const i = idx % arr.length
          const rt = createRuntime()
          const listStr = formatList(arr)

          const elem = rt.run(`lindex {${listStr}} ${i}`)
          expect(elem).toBe(arr[i])
        }),
        { numRuns: 20 }
      )
    })

    it('lindex end returns last element', () => {
      fc.assert(
        fc.property(arbList, arr => {
          fc.pre(arr.length > 0)
          const rt = createRuntime()
          const listStr = formatList(arr)

          const elem = rt.run(`lindex {${listStr}} end`)
          expect(elem).toBe(arr[arr.length - 1])
        }),
        { numRuns: 20 }
      )
    })

    it('lindex end equals lindex length-1', () => {
      fc.assert(
        fc.property(arbList, arr => {
          fc.pre(arr.length > 0)
          const rt = createRuntime()
          const listStr = formatList(arr)

          const viaEnd = rt.run(`lindex {${listStr}} end`)
          const viaNumeric = rt.run(`lindex {${listStr}} ${arr.length - 1}`)

          expect(viaEnd).toBe(viaNumeric)
        }),
        { numRuns: 15 }
      )
    })

    it('lrange 0 end returns entire list', () => {
      fc.assert(
        fc.property(arbList, arr => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          const ranged = rt.run(`lrange {${listStr}} 0 end`)
          const rangedLen = Number(rt.run(`llength {${ranged}}`))

          expect(rangedLen).toBe(arr.length)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Reverse Properties', () => {
    it('lreverse is involutive (double reverse equals original)', () => {
      fc.assert(
        fc.property(arbList, arr => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          const twice = rt.run(`lreverse [lreverse {${listStr}}]`)
          const twiceLen = Number(rt.run(`llength {${twice}}`))

          expect(twiceLen).toBe(arr.length)

          // Check each element
          for (let i = 0; i < arr.length; i++) {
            const elem = rt.run(`lindex {${twice}} ${i}`)
            expect(elem).toBe(arr[i])
          }
        }),
        { numRuns: 15 }
      )
    })

    it('lreverse of single element is same element', () => {
      fc.assert(
        fc.property(arbElement, elem => {
          const rt = createRuntime()

          const reversed = rt.run(`lreverse {${elem}}`)
          expect(reversed).toBe(elem)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Sort Properties', () => {
    it('lsort produces sorted output', () => {
      fc.assert(
        fc.property(arbList, arr => {
          fc.pre(arr.length > 1)
          const rt = createRuntime()
          const listStr = formatList(arr)

          const sorted = rt.run(`lsort {${listStr}}`)
          const sortedArr = parseList(sorted)

          // Verify sorted order
          for (let i = 1; i < sortedArr.length; i++) {
            expect(sortedArr[i - 1].localeCompare(sortedArr[i])).toBeLessThanOrEqual(0)
          }
        }),
        { numRuns: 15 }
      )
    })

    it('lsort is idempotent', () => {
      fc.assert(
        fc.property(arbList, arr => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          const once = rt.run(`lsort {${listStr}}`)
          const twice = rt.run(`lsort {${once}}`)

          expect(once).toBe(twice)
        }),
        { numRuns: 15 }
      )
    })

    it('lsort -decreasing reverses lsort result', () => {
      fc.assert(
        fc.property(arbList, arr => {
          fc.pre(arr.length > 0)
          const rt = createRuntime()
          const listStr = formatList(arr)

          const ascending = rt.run(`lsort {${listStr}}`)
          const descending = rt.run(`lsort -decreasing {${listStr}}`)
          const reversedAsc = rt.run(`lreverse {${ascending}}`)

          expect(descending).toBe(reversedAsc)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Search Properties', () => {
    it('lsearch finds existing element', () => {
      fc.assert(
        fc.property(arbList, fc.nat(), (arr, idx) => {
          fc.pre(arr.length > 0)
          const i = idx % arr.length
          const rt = createRuntime()
          const listStr = formatList(arr)
          const elem = arr[i]

          const foundIdx = Number(rt.run(`lsearch {${listStr}} {${elem}}`))

          // Should find at some valid index
          expect(foundIdx).toBeGreaterThanOrEqual(0)
          expect(foundIdx).toBeLessThan(arr.length)

          // Element at found index should match
          const atFound = rt.run(`lindex {${listStr}} ${foundIdx}`)
          expect(atFound).toBe(elem)
        }),
        { numRuns: 15 }
      )
    })

    it('lsearch returns -1 for non-existent element', () => {
      fc.assert(
        fc.property(arbList, arbElement, (arr, elem) => {
          fc.pre(!arr.includes(elem)) // Element not in list
          const rt = createRuntime()
          const listStr = formatList(arr)

          const foundIdx = Number(rt.run(`lsearch {${listStr}} {${elem}}`))
          expect(foundIdx).toBe(-1)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Join/Split Properties', () => {
    it('join with empty separator concatenates', () => {
      fc.assert(
        fc.property(arbList, arr => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          const joined = rt.run(`join {${listStr}} ""`)
          expect(joined).toBe(arr.join(''))
        }),
        { numRuns: 15 }
      )
    })

    it('split creates list elements', () => {
      fc.assert(
        fc.property(arbList, arr => {
          fc.pre(arr.length > 0)
          const rt = createRuntime()
          const joined = arr.join(',')

          const splitResult = rt.run(`split {${joined}} ,`)
          const splitLen = Number(rt.run(`llength {${splitResult}}`))

          expect(splitLen).toBe(arr.length)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Insert/Replace Properties', () => {
    it('linsert at 0 prepends element', () => {
      fc.assert(
        fc.property(arbList, arbElement, (arr, elem) => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          const result = rt.run(`linsert {${listStr}} 0 {${elem}}`)
          const first = rt.run(`lindex {${result}} 0`)

          expect(first).toBe(elem)
        }),
        { numRuns: 15 }
      )
    })

    it('linsert at length appends element', () => {
      fc.assert(
        fc.property(arbList, arbElement, (arr, elem) => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          // Insert at position equal to list length (appends)
          const result = rt.run(`linsert {${listStr}} ${arr.length} {${elem}}`)
          const last = rt.run(`lindex {${result}} end`)

          expect(last).toBe(elem)
        }),
        { numRuns: 15 }
      )
    })

    it('linsert increases length by one', () => {
      fc.assert(
        fc.property(arbList, arbElement, fc.nat(), (arr, elem, idx) => {
          const i = arr.length === 0 ? 0 : idx % (arr.length + 1)
          const rt = createRuntime()
          const listStr = formatList(arr)

          const result = rt.run(`linsert {${listStr}} ${i} {${elem}}`)
          const newLen = Number(rt.run(`llength {${result}}`))

          expect(newLen).toBe(arr.length + 1)
        }),
        { numRuns: 15 }
      )
    })
  })
})
