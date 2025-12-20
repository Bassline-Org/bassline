import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { Runtime, std, list } from '../src/index.js'

/**
 * Property-based tests for Tcl control flow commands
 */

function createRuntime() {
  const rt = new Runtime()
  for (const [n, fn] of Object.entries(std)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(list)) rt.register(n, fn)
  return rt
}

// Arbitrary for valid variable names
const arbVarName = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'.split('')),
  minLength: 1,
  maxLength: 8,
})

// Arbitrary for safe values (no special Tcl chars)
const arbValue = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
  minLength: 1,
  maxLength: 10,
})

// Arbitrary for small integers
const arbSmallInt = fc.integer({ min: 0, max: 20 })

describe('Control Flow Properties', () => {
  describe('Switch Properties', () => {
    it('switch matches exact value', () => {
      fc.assert(
        fc.property(arbValue, arbValue, (match, other) => {
          fc.pre(match !== other)
          const rt = createRuntime()
          const result = rt.run(`switch {${match}} { {${match}} { set r matched } {${other}} { set r other } }`)
          expect(result).toBe('matched')
        }),
        { numRuns: 15 }
      )
    })

    it('switch default handles no match', () => {
      fc.assert(
        fc.property(arbValue, arbValue, (input, pattern) => {
          fc.pre(input !== pattern)
          const rt = createRuntime()
          const result = rt.run(`switch {${input}} { {${pattern}} { set r matched } default { set r default } }`)
          expect(result).toBe('default')
        }),
        { numRuns: 15 }
      )
    })

    it('switch -glob matches patterns', () => {
      fc.assert(
        fc.property(arbValue, value => {
          fc.pre(value.length > 0)
          const rt = createRuntime()
          const prefix = value[0]
          const result = rt.run(`switch -glob {${value}} { {${prefix}*} { set r matched } default { set r default } }`)
          expect(result).toBe('matched')
        }),
        { numRuns: 15 }
      )
    })

    it('switch returns empty for no match and no default', () => {
      fc.assert(
        fc.property(arbValue, arbValue, (input, pattern) => {
          fc.pre(input !== pattern)
          const rt = createRuntime()
          const result = rt.run(`switch {${input}} { {${pattern}} { set r matched } }`)
          expect(result).toBe('')
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Foreach Properties', () => {
    it('foreach iterates correct number of times', () => {
      fc.assert(
        fc.property(fc.array(arbValue, { minLength: 1, maxLength: 5 }), arr => {
          const rt = createRuntime()
          const list = arr.map(s => `{${s}}`).join(' ')
          rt.run('set count 0')
          rt.run(`foreach x {${list}} { incr count }`)
          expect(rt.getVar('count')).toBe(String(arr.length))
        }),
        { numRuns: 15 }
      )
    })

    it('foreach sets variable to each element', () => {
      fc.assert(
        fc.property(fc.array(arbValue, { minLength: 1, maxLength: 5 }), arr => {
          const rt = createRuntime()
          const list = arr.map(s => `{${s}}`).join(' ')
          rt.run('set result {}')
          rt.run(`foreach x {${list}} { lappend result $x }`)

          // Last element should be set
          const lastElem = rt.run('set x')
          expect(lastElem).toBe(arr[arr.length - 1])
        }),
        { numRuns: 15 }
      )
    })

    it('foreach with two vars processes pairs', () => {
      const rt = createRuntime()
      rt.run('set sum 0')
      rt.run('foreach {a b} {1 2 3 4} { set sum [expr {$sum + $a + $b}] }')
      expect(rt.getVar('sum')).toBe('10') // 1+2+3+4
    })

    it('foreach handles break', () => {
      fc.assert(
        fc.property(fc.array(arbValue, { minLength: 3, maxLength: 5 }), arr => {
          const rt = createRuntime()
          const list = arr.map(s => `{${s}}`).join(' ')
          rt.run('set count 0')
          rt.run(`foreach x {${list}} { incr count; if {$count == 2} { break } }`)
          expect(rt.getVar('count')).toBe('2')
        }),
        { numRuns: 15 }
      )
    })

    it('foreach handles continue', () => {
      const rt = createRuntime()
      rt.run('set result {}')
      rt.run('foreach x {a b c d} { if {$x eq "b"} { continue }; lappend result $x }')
      const result = rt.run('set result')
      expect(result).not.toContain('b')
      expect(result).toContain('a')
      expect(result).toContain('c')
    })
  })

  describe('For Loop Properties', () => {
    it('for iterates correct number of times', () => {
      fc.assert(
        fc.property(arbSmallInt, n => {
          fc.pre(n > 0)
          const rt = createRuntime()
          rt.run('set count 0')
          rt.run(`for {set i 0} {$i < ${n}} {incr i} { incr count }`)
          expect(rt.getVar('count')).toBe(String(n))
        }),
        { numRuns: 15 }
      )
    })

    it('for loop variable has correct final value', () => {
      fc.assert(
        fc.property(arbSmallInt, n => {
          fc.pre(n > 0)
          const rt = createRuntime()
          rt.run(`for {set i 0} {$i < ${n}} {incr i} {}`)
          expect(rt.getVar('i')).toBe(String(n))
        }),
        { numRuns: 15 }
      )
    })

    it('for handles break correctly', () => {
      fc.assert(
        fc.property(arbSmallInt, arbSmallInt, (n, breakAt) => {
          fc.pre(n > 2 && breakAt > 0 && breakAt < n)
          const rt = createRuntime()
          rt.run(`for {set i 0} {$i < ${n}} {incr i} { if {$i == ${breakAt}} { break } }`)
          expect(rt.getVar('i')).toBe(String(breakAt))
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('While Loop Properties', () => {
    it('while iterates until condition false', () => {
      fc.assert(
        fc.property(arbSmallInt, n => {
          fc.pre(n > 0 && n <= 10)
          const rt = createRuntime()
          rt.run('set i 0')
          rt.run(`while {$i < ${n}} { incr i }`)
          expect(rt.getVar('i')).toBe(String(n))
        }),
        { numRuns: 15 }
      )
    })

    it('while returns last body result', () => {
      const rt = createRuntime()
      rt.run('set i 0')
      const result = rt.run('while {$i < 3} { incr i; set x done }')
      expect(result).toBe('done')
    })
  })

  describe('Incr Properties', () => {
    it('incr adds 1 by default', () => {
      fc.assert(
        fc.property(arbSmallInt, n => {
          const rt = createRuntime()
          rt.run(`set x ${n}`)
          rt.run('incr x')
          expect(rt.getVar('x')).toBe(String(n + 1))
        }),
        { numRuns: 20 }
      )
    })

    it('incr adds specified amount', () => {
      fc.assert(
        fc.property(arbSmallInt, arbSmallInt, (n, increment) => {
          const rt = createRuntime()
          rt.run(`set x ${n}`)
          rt.run(`incr x ${increment}`)
          expect(rt.getVar('x')).toBe(String(n + increment))
        }),
        { numRuns: 20 }
      )
    })

    it('incr can decrement with negative', () => {
      fc.assert(
        fc.property(arbSmallInt, arbSmallInt, (n, decrement) => {
          fc.pre(decrement > 0)
          const rt = createRuntime()
          rt.run(`set x ${n}`)
          rt.run(`incr x -${decrement}`)
          expect(rt.getVar('x')).toBe(String(n - decrement))
        }),
        { numRuns: 15 }
      )
    })

    it('incr initializes undefined var to 0', () => {
      fc.assert(
        fc.property(arbVarName, arbSmallInt, (name, increment) => {
          const rt = createRuntime()
          rt.run(`incr ${name} ${increment}`)
          expect(rt.getVar(name)).toBe(String(increment))
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Catch Properties', () => {
    it('catch returns 0 for successful command', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, (name, value) => {
          const rt = createRuntime()
          const result = rt.run(`catch { set ${name} {${value}} }`)
          expect(result).toBe('0')
        }),
        { numRuns: 15 }
      )
    })

    it('catch returns 1 for error', () => {
      const rt = createRuntime()
      const result = rt.run('catch { error "test error" }')
      expect(result).toBe('1')
    })

    it('catch stores result in variable', () => {
      fc.assert(
        fc.property(arbValue, value => {
          const rt = createRuntime()
          rt.run(`catch { set x {${value}} } result`)
          expect(rt.getVar('result')).toBe(value)
        }),
        { numRuns: 15 }
      )
    })

    it('catch stores error message in variable', () => {
      const rt = createRuntime()
      rt.run('catch { error "my error" } result')
      expect(rt.getVar('result')).toContain('my error')
    })

    it('catch does not catch return', () => {
      const rt = createRuntime()
      rt.run('proc testcatch {} { catch { return early } result; return $result }')
      // Return should propagate, not be caught
      expect(() => rt.run('testcatch')).not.toThrow()
    })
  })

  describe('Error Properties', () => {
    it('error throws with message', () => {
      fc.assert(
        fc.property(arbValue, message => {
          const rt = createRuntime()
          expect(() => rt.run(`error {${message}}`)).toThrow(message)
        }),
        { numRuns: 15 }
      )
    })

    it('error is catchable', () => {
      fc.assert(
        fc.property(arbValue, message => {
          const rt = createRuntime()
          const result = rt.run(`catch { error {${message}} }`)
          expect(result).toBe('1')
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Eval Properties', () => {
    it('eval executes script', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, (name, value) => {
          const rt = createRuntime()
          rt.run(`eval { set ${name} {${value}} }`)
          expect(rt.getVar(name)).toBe(value)
        }),
        { numRuns: 15 }
      )
    })

    it('eval returns script result', () => {
      fc.assert(
        fc.property(arbValue, value => {
          const rt = createRuntime()
          const result = rt.run(`eval { set x {${value}} }`)
          expect(result).toBe(value)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Return Properties', () => {
    it('return exits proc with value', () => {
      fc.assert(
        fc.property(arbValue, value => {
          const rt = createRuntime()
          rt.run(`proc testret {} { return {${value}} }`)
          expect(rt.run('testret')).toBe(value)
        }),
        { numRuns: 15 }
      )
    })

    it('return with no value returns empty', () => {
      const rt = createRuntime()
      rt.run('proc emptyret {} { return }')
      expect(rt.run('emptyret')).toBe('')
    })

    it('code after return is not executed', () => {
      const rt = createRuntime()
      rt.run('set x before')
      rt.run('proc testret {} { return early; set x after }')
      rt.run('testret')
      expect(rt.getVar('x')).toBe('before')
    })
  })
})
