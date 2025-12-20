import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { Runtime, TclError, std, string, list, dict, namespace, info, event } from '../src/index.js'

/**
 * Property-based tests for the Tcl runtime
 */

// Helper to create a fully-loaded runtime
function createRuntime() {
  const rt = new Runtime()
  for (const [name, fn] of Object.entries(std)) rt.register(name, fn)
  for (const [name, fn] of Object.entries(string)) rt.register(name, fn)
  for (const [name, fn] of Object.entries(list)) rt.register(name, fn)
  for (const [name, fn] of Object.entries(dict)) rt.register(name, fn)
  for (const [name, fn] of Object.entries(namespace)) rt.register(name, fn)
  for (const [name, fn] of Object.entries(info)) rt.register(name, fn)
  for (const [name, fn] of Object.entries(event)) rt.register(name, fn)
  return rt
}

// Arbitrary for valid Tcl variable names
const arbVarName = fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,10}$/).filter(s => s.length > 0)

// Arbitrary for safe string values
const arbSafeValue = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_'.split('')),
  minLength: 1,
  maxLength: 20,
})

describe('Runtime Properties', () => {
  describe('Safety Properties', () => {
    it('handles simple commands without crashing', () => {
      fc.assert(
        fc.property(arbVarName, arbSafeValue, (name, value) => {
          const rt = createRuntime()
          try {
            rt.run(`set ${name} ${value}`)
          } catch (err) {
            expect(err).toBeInstanceOf(Error)
          }
        }),
        { numRuns: 30 }
      )
    })

    it('errors are Error instances', () => {
      const rt = createRuntime()
      const badScripts = ['nonexistent_cmd', '{unclosed', '[unclosed']

      for (const script of badScripts) {
        try {
          rt.run(script)
        } catch (err) {
          expect(err).toBeInstanceOf(Error)
        }
      }
    })
  })

  describe('Variable Properties', () => {
    it('set then get returns same value', () => {
      fc.assert(
        fc.property(arbVarName, arbSafeValue, (name, value) => {
          const rt = createRuntime()
          rt.run(`set ${name} {${value}}`)
          expect(rt.getVar(name)).toBe(value)
        }),
        { numRuns: 30 }
      )
    })

    it('variables are independent', () => {
      fc.assert(
        fc.property(arbVarName, arbVarName, arbSafeValue, arbSafeValue, (name1, name2, value1, value2) => {
          fc.pre(name1 !== name2)
          const rt = createRuntime()
          rt.run(`set ${name1} {${value1}}`)
          rt.run(`set ${name2} {${value2}}`)
          expect(rt.getVar(name1)).toBe(value1)
          expect(rt.getVar(name2)).toBe(value2)
        }),
        { numRuns: 20 }
      )
    })

    it('overwriting variable updates value', () => {
      fc.assert(
        fc.property(arbVarName, arbSafeValue, arbSafeValue, (name, value1, value2) => {
          const rt = createRuntime()
          rt.run(`set ${name} {${value1}}`)
          rt.run(`set ${name} {${value2}}`)
          expect(rt.getVar(name)).toBe(value2)
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('Control Flow Properties', () => {
    it('if with true condition executes then branch', () => {
      fc.assert(
        fc.property(arbSafeValue, arbSafeValue, (thenVal, elseVal) => {
          const rt = createRuntime()
          rt.run(`if {1} {set result {${thenVal}}} else {set result {${elseVal}}}`)
          expect(rt.getVar('result')).toBe(thenVal)
        }),
        { numRuns: 20 }
      )
    })

    it('if with false condition executes else branch', () => {
      fc.assert(
        fc.property(arbSafeValue, arbSafeValue, (thenVal, elseVal) => {
          const rt = createRuntime()
          rt.run(`if {0} {set result {${thenVal}}} else {set result {${elseVal}}}`)
          expect(rt.getVar('result')).toBe(elseVal)
        }),
        { numRuns: 20 }
      )
    })

    it('while loop executes correct number of times', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10 }), count => {
          const rt = createRuntime()
          rt.run(`
            set i 0
            set sum 0
            while {$i < ${count}} { incr sum; incr i }
          `)
          expect(rt.getVar('sum')).toBe(String(count))
        }),
        { numRuns: 10 }
      )
    })

    it('for loop executes correct number of times', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10 }), count => {
          const rt = createRuntime()
          rt.run(`
            set sum 0
            for {set i 0} {$i < ${count}} {incr i} { incr sum }
          `)
          expect(rt.getVar('sum')).toBe(String(count))
        }),
        { numRuns: 10 }
      )
    })
  })

  describe('Error Handling Properties', () => {
    it('catch returns 0 on success', () => {
      const rt = createRuntime()
      const result = rt.run('catch {set x 1}')
      expect(result).toBe('0')
    })

    it('catch returns 1 on error', () => {
      const rt = createRuntime()
      const result = rt.run('catch {error "test error"}')
      expect(result).toBe('1')
    })

    it('catch stores result in variable', () => {
      const rt = createRuntime()
      rt.run('catch {set x hello} result')
      expect(rt.getVar('result')).toBe('hello')
    })
  })

  describe('Incr Properties', () => {
    it('incr adds increment value', () => {
      fc.assert(
        fc.property(fc.integer({ min: -50, max: 50 }), fc.integer({ min: -50, max: 50 }), (start, inc) => {
          const rt = createRuntime()
          rt.run(`set x ${start}`)
          rt.run(`incr x ${inc}`)
          expect(rt.getVar('x')).toBe(String(start + inc))
        }),
        { numRuns: 20 }
      )
    })
  })
})
