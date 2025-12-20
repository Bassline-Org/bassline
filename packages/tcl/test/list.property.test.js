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
    it('llength returns correct count', async () => {
      fc.assert(
        fc.asyncProperty(arbList, async arr => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          const len = Number(await rt.run(`llength {${listStr}}`))
          expect(len).toBe(arr.length)
        }),
        { numRuns: 20 }
      )
    })

    it('lappend increases length by one', async () => {
      fc.assert(
        fc.asyncProperty(arbList, arbElement, async (arr, elem) => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          await rt.run(`set mylist {${listStr}}`)
          await rt.run(`lappend mylist {${elem}}`)

          const newLen = Number(await rt.run('llength $mylist'))
          expect(newLen).toBe(arr.length + 1)
        }),
        { numRuns: 20 }
      )
    })

    it('concat preserves total length', async () => {
      fc.assert(
        fc.asyncProperty(arbList, arbList, async (arr1, arr2) => {
          const rt = createRuntime()
          const list1 = formatList(arr1)
          const list2 = formatList(arr2)

          const result = await rt.run(`concat {${list1}} {${list2}}`)
          const resultLen = Number(await rt.run(`llength {${result}}`))

          expect(resultLen).toBe(arr1.length + arr2.length)
        }),
        { numRuns: 15 }
      )
    })

    it('lreverse preserves length', async () => {
      fc.assert(
        fc.asyncProperty(arbList, async arr => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          const reversed = await rt.run(`lreverse {${listStr}}`)
          const reversedLen = Number(await rt.run(`llength {${reversed}}`))

          expect(reversedLen).toBe(arr.length)
        }),
        { numRuns: 20 }
      )
    })

    it('lsort preserves length', async () => {
      fc.assert(
        fc.asyncProperty(arbList, async arr => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          const sorted = await rt.run(`lsort {${listStr}}`)
          const sortedLen = Number(await rt.run(`llength {${sorted}}`))

          expect(sortedLen).toBe(arr.length)
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('Indexing Properties', () => {
    it('lindex returns correct element', async () => {
      fc.assert(
        fc.asyncProperty(arbList, fc.nat(), async (arr, idx) => {
          fc.pre(arr.length > 0)
          const i = idx % arr.length
          const rt = createRuntime()
          const listStr = formatList(arr)

          const elem = await rt.run(`lindex {${listStr}} ${i}`)
          expect(elem).toBe(arr[i])
        }),
        { numRuns: 20 }
      )
    })

    it('lindex end returns last element', async () => {
      fc.assert(
        fc.asyncProperty(arbList, async arr => {
          fc.pre(arr.length > 0)
          const rt = createRuntime()
          const listStr = formatList(arr)

          const elem = await rt.run(`lindex {${listStr}} end`)
          expect(elem).toBe(arr[arr.length - 1])
        }),
        { numRuns: 20 }
      )
    })

    it('lindex end equals lindex length-1', async () => {
      fc.assert(
        fc.asyncProperty(arbList, async arr => {
          fc.pre(arr.length > 0)
          const rt = createRuntime()
          const listStr = formatList(arr)

          const viaEnd = await rt.run(`lindex {${listStr}} end`)
          const viaNumeric = await rt.run(`lindex {${listStr}} ${arr.length - 1}`)

          expect(viaEnd).toBe(viaNumeric)
        }),
        { numRuns: 15 }
      )
    })

    it('lrange 0 end returns entire list', async () => {
      fc.assert(
        fc.asyncProperty(arbList, async arr => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          const ranged = await rt.run(`lrange {${listStr}} 0 end`)
          const rangedLen = Number(await rt.run(`llength {${ranged}}`))

          expect(rangedLen).toBe(arr.length)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Reverse Properties', () => {
    it('lreverse is involutive (double reverse equals original)', async () => {
      fc.assert(
        fc.asyncProperty(arbList, async arr => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          const twice = await rt.run(`lreverse [lreverse {${listStr}}]`)
          const twiceLen = Number(await rt.run(`llength {${twice}}`))

          expect(twiceLen).toBe(arr.length)

          // Check each element
          for (let i = 0; i < arr.length; i++) {
            const elem = await rt.run(`lindex {${twice}} ${i}`)
            expect(elem).toBe(arr[i])
          }
        }),
        { numRuns: 15 }
      )
    })

    it('lreverse of single element is same element', async () => {
      fc.assert(
        fc.asyncProperty(arbElement, async elem => {
          const rt = createRuntime()

          const reversed = await rt.run(`lreverse {${elem}}`)
          expect(reversed).toBe(elem)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Sort Properties', () => {
    it('lsort produces sorted output', async () => {
      fc.assert(
        fc.asyncProperty(arbList, async arr => {
          fc.pre(arr.length > 1)
          const rt = createRuntime()
          const listStr = formatList(arr)

          const sorted = await rt.run(`lsort {${listStr}}`)
          const sortedArr = parseList(sorted)

          // Verify sorted order
          for (let i = 1; i < sortedArr.length; i++) {
            expect(sortedArr[i - 1].localeCompare(sortedArr[i])).toBeLessThanOrEqual(0)
          }
        }),
        { numRuns: 15 }
      )
    })

    it('lsort is idempotent', async () => {
      fc.assert(
        fc.asyncProperty(arbList, async arr => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          const once = await rt.run(`lsort {${listStr}}`)
          const twice = await rt.run(`lsort {${once}}`)

          expect(once).toBe(twice)
        }),
        { numRuns: 15 }
      )
    })

    it('lsort -decreasing reverses lsort result', async () => {
      fc.assert(
        fc.asyncProperty(arbList, async arr => {
          fc.pre(arr.length > 0)
          const rt = createRuntime()
          const listStr = formatList(arr)

          const ascending = await rt.run(`lsort {${listStr}}`)
          const descending = await rt.run(`lsort -decreasing {${listStr}}`)
          const reversedAsc = await rt.run(`lreverse {${ascending}}`)

          expect(descending).toBe(reversedAsc)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Search Properties', () => {
    it('lsearch finds existing element', async () => {
      fc.assert(
        fc.asyncProperty(arbList, fc.nat(), async (arr, idx) => {
          fc.pre(arr.length > 0)
          const i = idx % arr.length
          const rt = createRuntime()
          const listStr = formatList(arr)
          const elem = arr[i]

          const foundIdx = Number(await rt.run(`lsearch {${listStr}} {${elem}}`))

          // Should find at some valid index
          expect(foundIdx).toBeGreaterThanOrEqual(0)
          expect(foundIdx).toBeLessThan(arr.length)

          // Element at found index should match
          const atFound = await rt.run(`lindex {${listStr}} ${foundIdx}`)
          expect(atFound).toBe(elem)
        }),
        { numRuns: 15 }
      )
    })

    it('lsearch returns -1 for non-existent element', async () => {
      fc.assert(
        fc.asyncProperty(arbList, arbElement, async (arr, elem) => {
          fc.pre(!arr.includes(elem)) // Element not in list
          const rt = createRuntime()
          const listStr = formatList(arr)

          const foundIdx = Number(await rt.run(`lsearch {${listStr}} {${elem}}`))
          expect(foundIdx).toBe(-1)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Join/Split Properties', () => {
    it('join with empty separator concatenates', async () => {
      fc.assert(
        fc.asyncProperty(arbList, async arr => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          const joined = await rt.run(`join {${listStr}} ""`)
          expect(joined).toBe(arr.join(''))
        }),
        { numRuns: 15 }
      )
    })

    it('split creates list elements', async () => {
      fc.assert(
        fc.asyncProperty(arbList, async arr => {
          fc.pre(arr.length > 0)
          const rt = createRuntime()
          const joined = arr.join(',')

          const splitResult = await rt.run(`split {${joined}} ,`)
          const splitLen = Number(await rt.run(`llength {${splitResult}}`))

          expect(splitLen).toBe(arr.length)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Insert/Replace Properties', () => {
    it('linsert at 0 prepends element', async () => {
      fc.assert(
        fc.asyncProperty(arbList, arbElement, async (arr, elem) => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          const result = await rt.run(`linsert {${listStr}} 0 {${elem}}`)
          const first = await rt.run(`lindex {${result}} 0`)

          expect(first).toBe(elem)
        }),
        { numRuns: 15 }
      )
    })

    it('linsert at length appends element', async () => {
      fc.assert(
        fc.asyncProperty(arbList, arbElement, async (arr, elem) => {
          const rt = createRuntime()
          const listStr = formatList(arr)

          // Insert at position equal to list length (appends)
          const result = await rt.run(`linsert {${listStr}} ${arr.length} {${elem}}`)
          const last = await rt.run(`lindex {${result}} end`)

          expect(last).toBe(elem)
        }),
        { numRuns: 15 }
      )
    })

    it('linsert increases length by one', async () => {
      fc.assert(
        fc.asyncProperty(arbList, arbElement, fc.nat(), async (arr, elem, idx) => {
          const i = arr.length === 0 ? 0 : idx % (arr.length + 1)
          const rt = createRuntime()
          const listStr = formatList(arr)

          const result = await rt.run(`linsert {${listStr}} ${i} {${elem}}`)
          const newLen = Number(await rt.run(`llength {${result}}`))

          expect(newLen).toBe(arr.length + 1)
        }),
        { numRuns: 15 }
      )
    })
  })
})
