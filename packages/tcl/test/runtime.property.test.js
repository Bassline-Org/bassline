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
    it('handles simple commands without crashing', async () => {
      fc.assert(
        fc.asyncProperty(arbVarName, arbSafeValue, async (name, value) => {
          const rt = createRuntime()
          try {
            await rt.run(`set ${name} ${value}`)
          } catch (err) {
            expect(err).toBeInstanceOf(Error)
          }
        }),
        { numRuns: 30 }
      )
    })

    it('errors are Error instances', async () => {
      const rt = createRuntime()
      const badScripts = ['nonexistent_cmd', '{unclosed', '[unclosed']

      for (const script of badScripts) {
        try {
          await rt.run(script)
        } catch (err) {
          expect(err).toBeInstanceOf(Error)
        }
      }
    })
  })

  describe('Variable Properties', () => {
    it('set then get returns same value', async () => {
      fc.assert(
        fc.asyncProperty(arbVarName, arbSafeValue, async (name, value) => {
          const rt = createRuntime()
          await rt.run(`set ${name} {${value}}`)
          expect(rt.getVar(name)).toBe(value)
        }),
        { numRuns: 30 }
      )
    })

    it('variables are independent', async () => {
      fc.assert(
        fc.asyncProperty(arbVarName, arbVarName, arbSafeValue, arbSafeValue, async (name1, name2, value1, value2) => {
          fc.pre(name1 !== name2)
          const rt = createRuntime()
          await rt.run(`set ${name1} {${value1}}`)
          await rt.run(`set ${name2} {${value2}}`)
          expect(rt.getVar(name1)).toBe(value1)
          expect(rt.getVar(name2)).toBe(value2)
        }),
        { numRuns: 20 }
      )
    })

    it('overwriting variable updates value', async () => {
      fc.assert(
        fc.asyncProperty(arbVarName, arbSafeValue, arbSafeValue, async (name, value1, value2) => {
          const rt = createRuntime()
          await rt.run(`set ${name} {${value1}}`)
          await rt.run(`set ${name} {${value2}}`)
          expect(rt.getVar(name)).toBe(value2)
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('Control Flow Properties', () => {
    it('if with true condition executes then branch', async () => {
      fc.assert(
        fc.asyncProperty(arbSafeValue, arbSafeValue, async (thenVal, elseVal) => {
          const rt = createRuntime()
          await rt.run(`if {1} {set result {${thenVal}}} else {set result {${elseVal}}}`)
          expect(rt.getVar('result')).toBe(thenVal)
        }),
        { numRuns: 20 }
      )
    })

    it('if with false condition executes else branch', async () => {
      fc.assert(
        fc.asyncProperty(arbSafeValue, arbSafeValue, async (thenVal, elseVal) => {
          const rt = createRuntime()
          await rt.run(`if {0} {set result {${thenVal}}} else {set result {${elseVal}}}`)
          expect(rt.getVar('result')).toBe(elseVal)
        }),
        { numRuns: 20 }
      )
    })

    it('while loop executes correct number of times', async () => {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 10 }), async count => {
          const rt = createRuntime()
          await rt.run(`
            set i 0
            set sum 0
            while {$i < ${count}} { incr sum; incr i }
          `)
          expect(rt.getVar('sum')).toBe(String(count))
        }),
        { numRuns: 10 }
      )
    })

    it('for loop executes correct number of times', async () => {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 10 }), async count => {
          const rt = createRuntime()
          await rt.run(`
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
    it('catch returns 0 on success', async () => {
      const rt = createRuntime()
      const result = await rt.run('catch {set x 1}')
      expect(result).toBe('0')
    })

    it('catch returns 1 on error', async () => {
      const rt = createRuntime()
      const result = await rt.run('catch {error "test error"}')
      expect(result).toBe('1')
    })

    it('catch stores result in variable', async () => {
      const rt = createRuntime()
      await rt.run('catch {set x hello} result')
      expect(rt.getVar('result')).toBe('hello')
    })
  })

  describe('Incr Properties', () => {
    it('incr adds increment value', async () => {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: -50, max: 50 }), fc.integer({ min: -50, max: 50 }), async (start, inc) => {
          const rt = createRuntime()
          await rt.run(`set x ${start}`)
          await rt.run(`incr x ${inc}`)
          expect(rt.getVar('x')).toBe(String(start + inc))
        }),
        { numRuns: 20 }
      )
    })
  })
})
