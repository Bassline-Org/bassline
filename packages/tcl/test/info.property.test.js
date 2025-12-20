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
    it('info exists returns 1 for set variable', async () => {
      fc.assert(
        fc.asyncProperty(arbVarName, arbValue, async (name, value) => {
          const rt = createRuntime()
          await rt.run(`set ${name} {${value}}`)
          expect(await rt.run(`info exists ${name}`)).toBe('1')
        }),
        { numRuns: 20 }
      )
    })

    it('info exists returns 0 for unset variable', async () => {
      fc.assert(
        fc.asyncProperty(arbVarName, async name => {
          const rt = createRuntime()
          expect(await rt.run(`info exists ${name}`)).toBe('0')
        }),
        { numRuns: 20 }
      )
    })

    it('info exists reflects variable state changes', async () => {
      fc.assert(
        fc.asyncProperty(arbVarName, arbValue, async (name, value) => {
          const rt = createRuntime()

          // Initially doesn't exist
          expect(await rt.run(`info exists ${name}`)).toBe('0')

          // After set, exists
          await rt.run(`set ${name} {${value}}`)
          expect(await rt.run(`info exists ${name}`)).toBe('1')
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Variable Listing', () => {
    it('info vars includes set variables', async () => {
      fc.assert(
        fc.asyncProperty(arbVarName, arbValue, async (name, value) => {
          const rt = createRuntime()
          await rt.run(`set ${name} {${value}}`)
          const vars = await rt.run('info vars')
          expect(vars).toContain(name)
        }),
        { numRuns: 15 }
      )
    })

    it('info vars with pattern filters correctly', async () => {
      fc.assert(
        fc.asyncProperty(arbVarName, arbValue, async (name, value) => {
          const rt = createRuntime()
          await rt.run(`set ${name} {${value}}`)
          await rt.run('set other_unrelated_var 123')

          // Pattern matching the variable should include it
          const vars = await rt.run(`info vars ${name}`)
          expect(vars).toContain(name)

          // Pattern starting with different letter shouldn't match
          const firstChar = name[0]
          const otherChar = firstChar === 'a' ? 'z' : 'a'
          const nonMatching = await rt.run(`info vars ${otherChar}*`)
          expect(nonMatching).not.toContain(name)
        }),
        { numRuns: 15 }
      )
    })

    it('info globals includes global variables', async () => {
      fc.assert(
        fc.asyncProperty(arbVarName, arbValue, async (name, value) => {
          const rt = createRuntime()
          await rt.run(`set ${name} {${value}}`)
          const globals = await rt.run('info globals')
          expect(globals).toContain(name)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Command Listing', () => {
    it('info commands includes registered commands', async () => {
      const rt = createRuntime()
      const cmds = await rt.run('info commands')

      // Should include built-in commands
      expect(cmds).toContain('set')
      expect(cmds).toContain('info')
      expect(cmds).toContain('proc')
    })

    it('info commands includes user-defined procs', async () => {
      fc.assert(
        fc.asyncProperty(arbProcName, async name => {
          const rt = createRuntime()
          await rt.run(`proc ${name} {} { return ok }`)
          const cmds = await rt.run('info commands')
          expect(cmds).toContain(name)
        }),
        { numRuns: 15 }
      )
    })

    it('info procs only includes user-defined procedures', async () => {
      fc.assert(
        fc.asyncProperty(arbProcName, async name => {
          const rt = createRuntime()
          await rt.run(`proc ${name} {} { return ok }`)
          const procs = await rt.run('info procs')

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
    it('info body returns procedure body', async () => {
      fc.assert(
        fc.asyncProperty(arbProcName, async name => {
          const rt = createRuntime()
          const body = 'return hello'
          await rt.run(`proc ${name} {} { ${body} }`)
          const result = await rt.run(`info body ${name}`)
          expect(result.trim()).toBe(body)
        }),
        { numRuns: 15 }
      )
    })

    it('info args returns procedure parameters', async () => {
      fc.assert(
        fc.asyncProperty(arbProcName, arbVarName, arbVarName, async (procName, param1, param2) => {
          fc.pre(param1 !== param2)
          const rt = createRuntime()
          await rt.run(`proc ${procName} {${param1} ${param2}} { return ok }`)
          const args = await rt.run(`info args ${procName}`)
          expect(args).toContain(param1)
          expect(args).toContain(param2)
        }),
        { numRuns: 15 }
      )
    })

    it('info body throws for non-proc', async () => {
      const rt = createRuntime()
      const result = await rt.run('catch { info body set }')
      expect(result).toBe('1') // Error caught
    })
  })

  describe('Script Completeness', () => {
    it('info complete returns 1 for balanced braces', async () => {
      fc.assert(
        fc.asyncProperty(arbValue, async value => {
          const rt = createRuntime()
          const result = await rt.run(`info complete {set x {${value}}}`)
          expect(result).toBe('1')
        }),
        { numRuns: 15 }
      )
    })

    it('info complete returns 0 for unbalanced braces', async () => {
      const rt = createRuntime()
      // Need to set the incomplete script as a variable first,
      // then pass the variable to info complete
      await rt.run('set incomplete_script "set x \\{"')
      expect(await rt.run('info complete $incomplete_script')).toBe('0')
    })

    it('info complete returns 1 for empty script', async () => {
      const rt = createRuntime()
      expect(await rt.run('info complete {}')).toBe('1')
    })

    it('info complete returns 1 for simple command', async () => {
      const rt = createRuntime()
      expect(await rt.run('info complete {set x 1}')).toBe('1')
    })
  })

  describe('Call Level', () => {
    it('info level returns 0 at top level', async () => {
      const rt = createRuntime()
      expect(await rt.run('info level')).toBe('0')
    })

    it('info level increases inside proc', async () => {
      const rt = createRuntime()
      await rt.run('proc testlevel {} { return [info level] }')
      const level = await rt.run('testlevel')
      expect(Number(level)).toBeGreaterThan(0)
    })

    it('nested procs have higher levels', async () => {
      const rt = createRuntime()
      await rt.run('proc inner {} { return [info level] }')
      await rt.run('proc outer {} { return [inner] }')

      const innerLevel = Number(await rt.run('inner'))
      const nestedLevel = Number(await rt.run('outer'))

      expect(nestedLevel).toBeGreaterThan(innerLevel)
    })
  })

  describe('Version Info', () => {
    it('info tclversion returns version string', async () => {
      const rt = createRuntime()
      const version = await rt.run('info tclversion')
      expect(version).toMatch(/^\d+\.\d+$/)
    })

    it('info patchlevel returns patch version', async () => {
      const rt = createRuntime()
      const patchlevel = await rt.run('info patchlevel')
      expect(patchlevel).toMatch(/^\d+\.\d+\.\d+$/)
    })
  })
})
