import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { Runtime, std, info, namespace } from '../src/index.js'

/**
 * Property-based tests for Tcl info introspection commands
 */

function createRuntime() {
  const rt = new Runtime()
  for (const [n, fn] of Object.entries(std)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(info)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(namespace)) rt.register(n, fn)
  return rt
}

// Arbitrary for valid variable names
const arbVarName = fc.string({
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

// Arbitrary for proc names
const arbProcName = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'.split('')),
  minLength: 2,
  maxLength: 8,
})

describe('Info Properties', () => {
  describe('Variable Existence', () => {
    it('info exists returns 1 for set variable', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, (name, value) => {
          const rt = createRuntime()
          rt.run(`set ${name} {${value}}`)
          expect(rt.run(`info exists ${name}`)).toBe('1')
        }),
        { numRuns: 20 }
      )
    })

    it('info exists returns 0 for unset variable', () => {
      fc.assert(
        fc.property(arbVarName, name => {
          const rt = createRuntime()
          expect(rt.run(`info exists ${name}`)).toBe('0')
        }),
        { numRuns: 20 }
      )
    })

    it('info exists reflects variable state changes', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, (name, value) => {
          const rt = createRuntime()

          // Initially doesn't exist
          expect(rt.run(`info exists ${name}`)).toBe('0')

          // After set, exists
          rt.run(`set ${name} {${value}}`)
          expect(rt.run(`info exists ${name}`)).toBe('1')
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Variable Listing', () => {
    it('info vars includes set variables', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, (name, value) => {
          const rt = createRuntime()
          rt.run(`set ${name} {${value}}`)
          const vars = rt.run('info vars')
          expect(vars).toContain(name)
        }),
        { numRuns: 15 }
      )
    })

    it('info vars with pattern filters correctly', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, (name, value) => {
          const rt = createRuntime()
          rt.run(`set ${name} {${value}}`)
          rt.run('set other_unrelated_var 123')

          // Pattern matching the variable should include it
          const vars = rt.run(`info vars ${name}`)
          expect(vars).toContain(name)

          // Pattern starting with different letter shouldn't match
          const firstChar = name[0]
          const otherChar = firstChar === 'a' ? 'z' : 'a'
          const nonMatching = rt.run(`info vars ${otherChar}*`)
          expect(nonMatching).not.toContain(name)
        }),
        { numRuns: 15 }
      )
    })

    it('info globals includes global variables', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, (name, value) => {
          const rt = createRuntime()
          rt.run(`set ${name} {${value}}`)
          const globals = rt.run('info globals')
          expect(globals).toContain(name)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Command Listing', () => {
    it('info commands includes registered commands', () => {
      const rt = createRuntime()
      const cmds = rt.run('info commands')

      // Should include built-in commands
      expect(cmds).toContain('set')
      expect(cmds).toContain('info')
      expect(cmds).toContain('proc')
    })

    it('info commands includes user-defined procs', () => {
      fc.assert(
        fc.property(arbProcName, name => {
          const rt = createRuntime()
          rt.run(`proc ${name} {} { return ok }`)
          const cmds = rt.run('info commands')
          expect(cmds).toContain(name)
        }),
        { numRuns: 15 }
      )
    })

    it('info procs only includes user-defined procedures', () => {
      fc.assert(
        fc.property(arbProcName, name => {
          const rt = createRuntime()
          rt.run(`proc ${name} {} { return ok }`)
          const procs = rt.run('info procs')

          // Should include our proc
          expect(procs).toContain(name)

          // Should not include built-in commands
          expect(procs).not.toContain('set')
          expect(procs).not.toContain('if')
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Procedure Introspection', () => {
    it('info body returns procedure body', () => {
      fc.assert(
        fc.property(arbProcName, name => {
          const rt = createRuntime()
          const body = 'return hello'
          rt.run(`proc ${name} {} { ${body} }`)
          const result = rt.run(`info body ${name}`)
          expect(result.trim()).toBe(body)
        }),
        { numRuns: 15 }
      )
    })

    it('info args returns procedure parameters', () => {
      fc.assert(
        fc.property(arbProcName, arbVarName, arbVarName, (procName, param1, param2) => {
          fc.pre(param1 !== param2)
          const rt = createRuntime()
          rt.run(`proc ${procName} {${param1} ${param2}} { return ok }`)
          const args = rt.run(`info args ${procName}`)
          expect(args).toContain(param1)
          expect(args).toContain(param2)
        }),
        { numRuns: 15 }
      )
    })

    it('info body throws for non-proc', () => {
      const rt = createRuntime()
      const result = rt.run('catch { info body set }')
      expect(result).toBe('1') // Error caught
    })
  })

  describe('Script Completeness', () => {
    it('info complete returns 1 for balanced braces', () => {
      fc.assert(
        fc.property(arbValue, value => {
          const rt = createRuntime()
          const result = rt.run(`info complete {set x {${value}}}`)
          expect(result).toBe('1')
        }),
        { numRuns: 15 }
      )
    })

    it('info complete returns 0 for unbalanced braces', () => {
      const rt = createRuntime()
      // Need to set the incomplete script as a variable first,
      // then pass the variable to info complete
      rt.run('set incomplete_script "set x \\{"')
      expect(rt.run('info complete $incomplete_script')).toBe('0')
    })

    it('info complete returns 1 for empty script', () => {
      const rt = createRuntime()
      expect(rt.run('info complete {}')).toBe('1')
    })

    it('info complete returns 1 for simple command', () => {
      const rt = createRuntime()
      expect(rt.run('info complete {set x 1}')).toBe('1')
    })
  })

  describe('Call Level', () => {
    it('info level returns 0 at top level', () => {
      const rt = createRuntime()
      expect(rt.run('info level')).toBe('0')
    })

    it('info level increases inside proc', () => {
      const rt = createRuntime()
      rt.run('proc testlevel {} { return [info level] }')
      const level = rt.run('testlevel')
      expect(Number(level)).toBeGreaterThan(0)
    })

    it('nested procs have higher levels', () => {
      const rt = createRuntime()
      rt.run('proc inner {} { return [info level] }')
      rt.run('proc outer {} { return [inner] }')

      const innerLevel = Number(rt.run('inner'))
      const nestedLevel = Number(rt.run('outer'))

      expect(nestedLevel).toBeGreaterThan(innerLevel)
    })
  })

  describe('Version Info', () => {
    it('info tclversion returns version string', () => {
      const rt = createRuntime()
      const version = rt.run('info tclversion')
      expect(version).toMatch(/^\d+\.\d+$/)
    })

    it('info patchlevel returns patch version', () => {
      const rt = createRuntime()
      const patchlevel = rt.run('info patchlevel')
      expect(patchlevel).toMatch(/^\d+\.\d+\.\d+$/)
    })
  })
})
