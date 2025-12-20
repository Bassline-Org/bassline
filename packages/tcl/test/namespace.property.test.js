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
    it('variables in different namespaces are independent', () => {
      fc.assert(
        fc.property(arbNsName, arbNsName, arbVarName, arbValue, arbValue, (ns1, ns2, varName, val1, val2) => {
          fc.pre(ns1 !== ns2) // Different namespace names

          const rt = createRuntime()

          // Set variable in first namespace
          rt.run(`namespace eval ${ns1} { set ${varName} {${val1}} }`)

          // Set same-named variable in second namespace
          rt.run(`namespace eval ${ns2} { set ${varName} {${val2}} }`)

          // Values should be independent
          const result1 = rt.run(`namespace eval ${ns1} { set ${varName} }`)
          const result2 = rt.run(`namespace eval ${ns2} { set ${varName} }`)

          expect(result1).toBe(val1)
          expect(result2).toBe(val2)
        }),
        { numRuns: 20 }
      )
    })

    it('child namespace variables dont affect parent', () => {
      fc.assert(
        fc.property(arbNsName, arbVarName, arbValue, arbValue, (nsName, varName, parentVal, childVal) => {
          const rt = createRuntime()

          // Set in root namespace
          rt.run(`set ${varName} {${parentVal}}`)

          // Set in child namespace
          rt.run(`namespace eval ${nsName} { set ${varName} {${childVal}} }`)

          // Root value should be unchanged
          expect(rt.getVar(varName)).toBe(parentVal)
        }),
        { numRuns: 20 }
      )
    })

    it('namespace current returns correct path', () => {
      fc.assert(
        fc.property(arbNsName, nsName => {
          const rt = createRuntime()

          // In root namespace
          expect(rt.run('namespace current')).toBe('/')

          // In child namespace
          const current = rt.run(`namespace eval ${nsName} { namespace current }`)
          expect(current).toBe(`/${nsName}`)
        }),
        { numRuns: 15 }
      )
    })

    it('nested namespaces have correct paths', () => {
      fc.assert(
        fc.property(arbNsName, arbNsName, (parent, child) => {
          const rt = createRuntime()

          const current = rt.run(`namespace eval ${parent} { namespace eval ${child} { namespace current } }`)
          expect(current).toBe(`/${parent}/${child}`)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Namespace Existence', () => {
    it('namespace exists after eval', () => {
      fc.assert(
        fc.property(arbNsName, nsName => {
          const rt = createRuntime()

          // Doesn't exist before
          expect(rt.run(`namespace exists ${nsName}`)).toBe('0')

          // Create it
          rt.run(`namespace eval ${nsName} {}`)

          // Now exists
          expect(rt.run(`namespace exists ${nsName}`)).toBe('1')
        }),
        { numRuns: 15 }
      )
    })

    it('namespace delete removes namespace', () => {
      fc.assert(
        fc.property(arbNsName, nsName => {
          const rt = createRuntime()

          // Create and then delete
          rt.run(`namespace eval ${nsName} {}`)
          rt.run(`namespace delete ${nsName}`)

          // No longer exists
          expect(rt.run(`namespace exists ${nsName}`)).toBe('0')
        }),
        { numRuns: 15 }
      )
    })

    it('namespace children lists created children', () => {
      fc.assert(
        fc.property(arbNsName, arbNsName, (child1, child2) => {
          fc.pre(child1 !== child2)

          const rt = createRuntime()

          // Create children
          rt.run(`namespace eval ${child1} {}`)
          rt.run(`namespace eval ${child2} {}`)

          // List children
          const children = rt.run('namespace children')

          expect(children).toContain(`/${child1}`)
          expect(children).toContain(`/${child2}`)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Namespace Path Operations', () => {
    it('qualifiers extracts namespace part', () => {
      fc.assert(
        fc.property(arbNsName, arbNsName, arbVarName, (ns1, ns2, name) => {
          const rt = createRuntime()

          const qual = rt.run(`namespace qualifiers ${ns1}/${ns2}/${name}`)
          expect(qual).toBe(`${ns1}/${ns2}`)
        }),
        { numRuns: 15 }
      )
    })

    it('tail extracts simple name', () => {
      fc.assert(
        fc.property(arbNsName, arbNsName, arbVarName, (ns1, ns2, name) => {
          const rt = createRuntime()

          const tail = rt.run(`namespace tail ${ns1}/${ns2}/${name}`)
          expect(tail).toBe(name)
        }),
        { numRuns: 15 }
      )
    })

    it('qualifiers + tail reconstructs path', () => {
      fc.assert(
        fc.property(arbNsName, arbVarName, (nsName, varName) => {
          const rt = createRuntime()
          const fullPath = `${nsName}/${varName}`

          const qual = rt.run(`namespace qualifiers ${fullPath}`)
          const tail = rt.run(`namespace tail ${fullPath}`)

          expect(`${qual}/${tail}`).toBe(fullPath)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Variable Linking', () => {
    it('global links to root namespace variable', () => {
      fc.assert(
        fc.property(arbNsName, arbVarName, arbValue, (nsName, varName, value) => {
          const rt = createRuntime()

          // Set global variable
          rt.run(`set ${varName} {${value}}`)

          // Access from child namespace via global
          const result = rt.run(`namespace eval ${nsName} { global ${varName}; set ${varName} }`)

          expect(result).toBe(value)
        }),
        { numRuns: 15 }
      )
    })

    it('global modification affects root', () => {
      fc.assert(
        fc.property(arbNsName, arbVarName, arbValue, arbValue, (nsName, varName, original, newVal) => {
          const rt = createRuntime()

          // Set global variable
          rt.run(`set ${varName} {${original}}`)

          // Modify from child namespace via global
          rt.run(`namespace eval ${nsName} { global ${varName}; set ${varName} {${newVal}} }`)

          // Root variable should be modified
          expect(rt.getVar(varName)).toBe(newVal)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Proc Scoping', () => {
    it('proc variables are local by default', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, arbValue, (varName, outerVal, innerVal) => {
          const rt = createRuntime()

          // Set outer variable
          rt.run(`set ${varName} {${outerVal}}`)

          // Define proc that sets same-named local variable
          rt.run(`proc testproc {} { set ${varName} {${innerVal}}; return $${varName} }`)

          // Call proc
          const procResult = rt.run('testproc')

          // Proc returns inner value
          expect(procResult).toBe(innerVal)

          // Outer value unchanged
          expect(rt.getVar(varName)).toBe(outerVal)
        }),
        { numRuns: 15 }
      )
    })

    it('proc parameters become local variables', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, (paramName, value) => {
          const rt = createRuntime()

          // Define proc with parameter
          rt.run(`proc echo {${paramName}} { return $${paramName} }`)

          // Call with value
          const result = rt.run(`echo {${value}}`)

          expect(result).toBe(value)
        }),
        { numRuns: 15 }
      )
    })

    it('upvar links to caller variable', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, arbValue, (varName, original, newVal) => {
          const rt = createRuntime()

          // Define proc that modifies caller's variable
          rt.run(`proc modifier {vname newval} { upvar 1 $vname local; set local $newval }`)

          // Set variable
          rt.run(`set ${varName} {${original}}`)

          // Call modifier
          rt.run(`modifier ${varName} {${newVal}}`)

          // Variable should be modified
          expect(rt.getVar(varName)).toBe(newVal)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Error Cases', () => {
    it('accessing non-existent namespace variable throws', () => {
      fc.assert(
        fc.property(arbNsName, arbVarName, (nsName, varName) => {
          const rt = createRuntime()

          // Create namespace but don't set variable
          rt.run(`namespace eval ${nsName} {}`)

          // Accessing non-existent variable should throw
          const result = rt.run(`catch { namespace eval ${nsName} { set ${varName} } }`)
          expect(result).toBe('1') // catch returns 1 on error
        }),
        { numRuns: 10 }
      )
    })

    it('namespace parent of root returns empty', () => {
      const rt = createRuntime()
      const parent = rt.run('namespace parent')
      expect(parent).toBe('')
    })
  })
})
