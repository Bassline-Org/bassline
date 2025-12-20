import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { Runtime, std, namespace, info } from '../src/index.js'

/**
 * Property-based tests for Tcl namespace system
 */

function createRuntime() {
  const rt = new Runtime()
  for (const [n, fn] of Object.entries(std)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(namespace)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(info)) rt.register(n, fn)
  return rt
}

// Arbitrary for valid namespace names (no special chars)
const arbNsName = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'.split('')),
  minLength: 1,
  maxLength: 8,
})

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

describe('Namespace Properties', () => {
  describe('Namespace Isolation', () => {
    it('variables in different namespaces are independent', async () => {
      fc.assert(
        fc.asyncProperty(
          arbNsName,
          arbNsName,
          arbVarName,
          arbValue,
          arbValue,
          async (ns1, ns2, varName, val1, val2) => {
            fc.pre(ns1 !== ns2) // Different namespace names

            const rt = createRuntime()

            // Set variable in first namespace
            await rt.run(`namespace eval ${ns1} { set ${varName} {${val1}} }`)

            // Set same-named variable in second namespace
            await rt.run(`namespace eval ${ns2} { set ${varName} {${val2}} }`)

            // Values should be independent
            const result1 = await rt.run(`namespace eval ${ns1} { set ${varName} }`)
            const result2 = await rt.run(`namespace eval ${ns2} { set ${varName} }`)

            expect(result1).toBe(val1)
            expect(result2).toBe(val2)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('child namespace variables dont affect parent', async () => {
      fc.assert(
        fc.asyncProperty(arbNsName, arbVarName, arbValue, arbValue, async (nsName, varName, parentVal, childVal) => {
          const rt = createRuntime()

          // Set in root namespace
          await rt.run(`set ${varName} {${parentVal}}`)

          // Set in child namespace
          await rt.run(`namespace eval ${nsName} { set ${varName} {${childVal}} }`)

          // Root value should be unchanged
          expect(rt.getVar(varName)).toBe(parentVal)
        }),
        { numRuns: 20 }
      )
    })

    it('namespace current returns correct path', async () => {
      fc.assert(
        fc.asyncProperty(arbNsName, async nsName => {
          const rt = createRuntime()

          // In root namespace
          expect(await rt.run('namespace current')).toBe('/')

          // In child namespace
          const current = await rt.run(`namespace eval ${nsName} { namespace current }`)
          expect(current).toBe(`/${nsName}`)
        }),
        { numRuns: 15 }
      )
    })

    it('nested namespaces have correct paths', async () => {
      fc.assert(
        fc.asyncProperty(arbNsName, arbNsName, async (parent, child) => {
          const rt = createRuntime()

          const current = await rt.run(`namespace eval ${parent} { namespace eval ${child} { namespace current } }`)
          expect(current).toBe(`/${parent}/${child}`)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Namespace Existence', () => {
    it('namespace exists after eval', async () => {
      fc.assert(
        fc.asyncProperty(arbNsName, async nsName => {
          const rt = createRuntime()

          // Doesn't exist before
          expect(await rt.run(`namespace exists ${nsName}`)).toBe('0')

          // Create it
          await rt.run(`namespace eval ${nsName} {}`)

          // Now exists
          expect(await rt.run(`namespace exists ${nsName}`)).toBe('1')
        }),
        { numRuns: 15 }
      )
    })

    it('namespace delete removes namespace', async () => {
      fc.assert(
        fc.asyncProperty(arbNsName, async nsName => {
          const rt = createRuntime()

          // Create and then delete
          await rt.run(`namespace eval ${nsName} {}`)
          await rt.run(`namespace delete ${nsName}`)

          // No longer exists
          expect(await rt.run(`namespace exists ${nsName}`)).toBe('0')
        }),
        { numRuns: 15 }
      )
    })

    it('namespace children lists created children', async () => {
      fc.assert(
        fc.asyncProperty(arbNsName, arbNsName, async (child1, child2) => {
          fc.pre(child1 !== child2)

          const rt = createRuntime()

          // Create children
          await rt.run(`namespace eval ${child1} {}`)
          await rt.run(`namespace eval ${child2} {}`)

          // List children
          const children = await rt.run('namespace children')

          expect(children).toContain(`/${child1}`)
          expect(children).toContain(`/${child2}`)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Namespace Path Operations', () => {
    it('qualifiers extracts namespace part', async () => {
      fc.assert(
        fc.asyncProperty(arbNsName, arbNsName, arbVarName, async (ns1, ns2, name) => {
          const rt = createRuntime()

          const qual = await rt.run(`namespace qualifiers ${ns1}/${ns2}/${name}`)
          expect(qual).toBe(`${ns1}/${ns2}`)
        }),
        { numRuns: 15 }
      )
    })

    it('tail extracts simple name', async () => {
      fc.assert(
        fc.asyncProperty(arbNsName, arbNsName, arbVarName, async (ns1, ns2, name) => {
          const rt = createRuntime()

          const tail = await rt.run(`namespace tail ${ns1}/${ns2}/${name}`)
          expect(tail).toBe(name)
        }),
        { numRuns: 15 }
      )
    })

    it('qualifiers + tail reconstructs path', async () => {
      fc.assert(
        fc.asyncProperty(arbNsName, arbVarName, async (nsName, varName) => {
          const rt = createRuntime()
          const fullPath = `${nsName}/${varName}`

          const qual = await rt.run(`namespace qualifiers ${fullPath}`)
          const tail = await rt.run(`namespace tail ${fullPath}`)

          expect(`${qual}/${tail}`).toBe(fullPath)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Variable Linking', () => {
    it('global links to root namespace variable', async () => {
      fc.assert(
        fc.asyncProperty(arbNsName, arbVarName, arbValue, async (nsName, varName, value) => {
          const rt = createRuntime()

          // Set global variable
          await rt.run(`set ${varName} {${value}}`)

          // Access from child namespace via global
          const result = await rt.run(`namespace eval ${nsName} { global ${varName}; set ${varName} }`)

          expect(result).toBe(value)
        }),
        { numRuns: 15 }
      )
    })

    it('global modification affects root', async () => {
      fc.assert(
        fc.asyncProperty(arbNsName, arbVarName, arbValue, arbValue, async (nsName, varName, original, newVal) => {
          const rt = createRuntime()

          // Set global variable
          await rt.run(`set ${varName} {${original}}`)

          // Modify from child namespace via global
          await rt.run(`namespace eval ${nsName} { global ${varName}; set ${varName} {${newVal}} }`)

          // Root variable should be modified
          expect(rt.getVar(varName)).toBe(newVal)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Proc Scoping', () => {
    it('proc variables are local by default', async () => {
      fc.assert(
        fc.asyncProperty(arbVarName, arbValue, arbValue, async (varName, outerVal, innerVal) => {
          const rt = createRuntime()

          // Set outer variable
          await rt.run(`set ${varName} {${outerVal}}`)

          // Define proc that sets same-named local variable
          await rt.run(`proc testproc {} { set ${varName} {${innerVal}}; return $${varName} }`)

          // Call proc
          const procResult = await rt.run('testproc')

          // Proc returns inner value
          expect(procResult).toBe(innerVal)

          // Outer value unchanged
          expect(rt.getVar(varName)).toBe(outerVal)
        }),
        { numRuns: 15 }
      )
    })

    it('proc parameters become local variables', async () => {
      fc.assert(
        fc.asyncProperty(arbVarName, arbValue, async (paramName, value) => {
          const rt = createRuntime()

          // Define proc with parameter
          await rt.run(`proc echo {${paramName}} { return $${paramName} }`)

          // Call with value
          const result = await rt.run(`echo {${value}}`)

          expect(result).toBe(value)
        }),
        { numRuns: 15 }
      )
    })

    it('upvar links to caller variable', async () => {
      fc.assert(
        fc.asyncProperty(arbVarName, arbValue, arbValue, async (varName, original, newVal) => {
          const rt = createRuntime()

          // Define proc that modifies caller's variable
          await rt.run(`proc modifier {vname newval} { upvar 1 $vname local; set local $newval }`)

          // Set variable
          await rt.run(`set ${varName} {${original}}`)

          // Call modifier
          await rt.run(`modifier ${varName} {${newVal}}`)

          // Variable should be modified
          expect(rt.getVar(varName)).toBe(newVal)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Namespace Export/Import', () => {
    it('exported proc can be imported', async () => {
      fc.assert(
        fc.asyncProperty(arbNsName, async nsName => {
          const rt = createRuntime()

          // Create namespace with exported proc
          await rt.run(`namespace eval ${nsName} { proc greet {} { return hello }; namespace export greet }`)

          // Import into root namespace
          await rt.run(`namespace import ${nsName}/greet`)

          // Should be callable without namespace prefix
          const result = await rt.run('greet')
          expect(result).toBe('hello')
        }),
        { numRuns: 10 }
      )
    })

    it('export with pattern exports multiple procs', async () => {
      const rt = createRuntime()

      // Create namespace with multiple procs
      await rt.run(
        'namespace eval mylib { proc foo {} { return foo }; proc foobar {} { return foobar }; proc bar {} { return bar }; namespace export foo* }'
      )

      // Import all matching exports
      await rt.run('namespace import mylib/*')

      // foo and foobar should be available, but not bar
      expect(await rt.run('foo')).toBe('foo')
      expect(await rt.run('foobar')).toBe('foobar')
      const result = await rt.run('catch { bar }')
      expect(result).toBe('1') // bar not imported
    })

    it('namespace forget removes imported command', async () => {
      const rt = createRuntime()

      // Create namespace and export
      await rt.run('namespace eval lib { proc cmd {} { return result }; namespace export cmd }')

      // Import
      await rt.run('namespace import lib/cmd')

      // Should work
      expect(await rt.run('cmd')).toBe('result')

      // Forget it
      await rt.run('namespace forget lib/cmd')

      // Should no longer exist
      const result = await rt.run('catch { cmd }')
      expect(result).toBe('1')
    })

    it('import -force overwrites existing command', async () => {
      const rt = createRuntime()

      // Create two namespaces with same-named proc
      await rt.run('namespace eval lib1 { proc cmd {} { return lib1 }; namespace export cmd }')
      await rt.run('namespace eval lib2 { proc cmd {} { return lib2 }; namespace export cmd }')

      // Import from lib1
      await rt.run('namespace import lib1/cmd')
      expect(await rt.run('cmd')).toBe('lib1')

      // Import from lib2 with -force (overwrite)
      await rt.run('namespace import -force lib2/cmd')
      expect(await rt.run('cmd')).toBe('lib2')
    })

    it('export -clear removes previous exports', async () => {
      const rt = createRuntime()

      // Create namespace with exports
      await rt.run(
        'namespace eval lib { proc foo {} { return foo }; proc bar {} { return bar }; namespace export foo bar }'
      )

      // Import bar
      await rt.run('namespace import lib/bar')
      expect(await rt.run('bar')).toBe('bar')

      // Forget bar
      await rt.run('namespace forget lib/bar')

      // Clear exports and only export foo
      await rt.run('namespace eval lib { namespace export -clear foo }')

      // Now importing bar should fail (not exported anymore)
      await rt.run('namespace import lib/*')

      // foo should work
      expect(await rt.run('foo')).toBe('foo')

      // bar should fail (not exported)
      const result = await rt.run('catch { bar }')
      expect(result).toBe('1')
    })
  })

  describe('Error Cases', () => {
    it('accessing non-existent namespace variable throws', async () => {
      fc.assert(
        fc.asyncProperty(arbNsName, arbVarName, async (nsName, varName) => {
          const rt = createRuntime()

          // Create namespace but don't set variable
          await rt.run(`namespace eval ${nsName} {}`)

          // Accessing non-existent variable should throw
          const result = await rt.run(`catch { namespace eval ${nsName} { set ${varName} } }`)
          expect(result).toBe('1') // catch returns 1 on error
        }),
        { numRuns: 10 }
      )
    })

    it('namespace parent of root returns empty', async () => {
      const rt = createRuntime()
      const parent = await rt.run('namespace parent')
      expect(parent).toBe('')
    })

    it('circular variable links are detected and throw error', async () => {
      const rt = createRuntime()

      // Create a circular link by directly manipulating the links map
      // This simulates a scenario where x -> y and y -> x in the same namespace
      const ns = rt.current
      if (!ns.links) ns.links = new Map()
      ns.links.set('x', { ns, name: 'y' })
      ns.links.set('y', { ns, name: 'x' })

      // Attempting to access the circular link should throw
      const result = await rt.run('catch { set x 1 }')
      expect(result).toBe('1')

      // Verify the error message mentions circular link
      const errorMsg = await rt.run('catch { set x 1 } msg; set msg')
      expect(errorMsg).toContain('circular')
    })

    it('longer circular variable links are detected', async () => {
      const rt = createRuntime()

      // Create a longer circular link: a -> b -> c -> a
      const ns = rt.current
      if (!ns.links) ns.links = new Map()
      ns.links.set('a', { ns, name: 'b' })
      ns.links.set('b', { ns, name: 'c' })
      ns.links.set('c', { ns, name: 'a' })

      // Attempting to access the circular link should throw
      const result = await rt.run('catch { set a 1 }')
      expect(result).toBe('1')

      const errorMsg = await rt.run('catch { set a 1 } msg; set msg')
      expect(errorMsg).toContain('circular')
    })
  })
})
