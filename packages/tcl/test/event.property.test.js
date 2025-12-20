import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { Runtime, std, event, list } from '../src/index.js'

/**
 * Property-based tests for Tcl event/trace commands
 */

function createRuntime() {
  const rt = new Runtime()
  for (const [n, fn] of Object.entries(std)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(event)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(list)) rt.register(n, fn)
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

describe('Event Properties', () => {
  describe('Unset Properties', () => {
    it('unset removes variable', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, (name, value) => {
          const rt = createRuntime()
          rt.run(`set ${name} {${value}}`)
          rt.run(`unset ${name}`)

          // Variable should no longer exist
          expect(() => rt.getVar(name)).toThrow()
        }),
        { numRuns: 20 }
      )
    })

    it('unset multiple variables', () => {
      fc.assert(
        fc.property(arbVarName, arbVarName, arbValue, (name1, name2, value) => {
          fc.pre(name1 !== name2)
          const rt = createRuntime()

          rt.run(`set ${name1} {${value}}`)
          rt.run(`set ${name2} {${value}}`)
          rt.run(`unset ${name1} ${name2}`)

          expect(() => rt.getVar(name1)).toThrow()
          expect(() => rt.getVar(name2)).toThrow()
        }),
        { numRuns: 15 }
      )
    })

    it('unset returns empty string', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, (name, value) => {
          const rt = createRuntime()
          rt.run(`set ${name} {${value}}`)
          const result = rt.run(`unset ${name}`)
          expect(result).toBe('')
        }),
        { numRuns: 15 }
      )
    })

    it('unset then set creates fresh variable', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, arbValue, (name, val1, val2) => {
          const rt = createRuntime()

          rt.run(`set ${name} {${val1}}`)
          rt.run(`unset ${name}`)
          rt.run(`set ${name} {${val2}}`)

          expect(rt.getVar(name)).toBe(val2)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('Trace Properties', () => {
    it('trace add write fires on set', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, (name, value) => {
          const rt = createRuntime()

          // Set up trace counter
          rt.run('set trace_count 0')
          rt.run(`trace add variable ${name} {write} { incr trace_count }`)

          // Setting variable should trigger trace
          rt.run(`set ${name} {${value}}`)

          expect(rt.getVar('trace_count')).toBe('1')
        }),
        { numRuns: 15 }
      )
    })

    it('trace fires multiple times on multiple writes', () => {
      fc.assert(
        fc.property(arbVarName, fc.integer({ min: 2, max: 5 }), (name, count) => {
          const rt = createRuntime()

          rt.run('set trace_count 0')
          rt.run(`trace add variable ${name} {write} { incr trace_count }`)

          // Multiple writes
          for (let i = 0; i < count; i++) {
            rt.run(`set ${name} value${i}`)
          }

          expect(rt.getVar('trace_count')).toBe(String(count))
        }),
        { numRuns: 15 }
      )
    })

    it('trace remove stops triggering', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, (name, value) => {
          const rt = createRuntime()

          rt.run('set trace_count 0')
          const script = '{ incr trace_count }'
          rt.run(`trace add variable ${name} {write} ${script}`)

          // First write triggers
          rt.run(`set ${name} first`)
          expect(rt.getVar('trace_count')).toBe('1')

          // Remove trace
          rt.run(`trace remove variable ${name} {write} ${script}`)

          // Second write should not trigger
          rt.run(`set ${name} {${value}}`)
          expect(rt.getVar('trace_count')).toBe('1')
        }),
        { numRuns: 15 }
      )
    })

    it('trace info returns registered traces', () => {
      fc.assert(
        fc.property(arbVarName, name => {
          const rt = createRuntime()

          rt.run(`trace add variable ${name} {write} { set x 1 }`)
          const info = rt.run(`trace info variable ${name}`)

          expect(info).toContain('write')
        }),
        { numRuns: 15 }
      )
    })

    it('trace can access trace variables', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, (name, value) => {
          const rt = createRuntime()

          // Trace that captures the new value
          rt.run(`trace add variable ${name} {write} { set captured $_trace_new }`)
          rt.run(`set ${name} {${value}}`)

          expect(rt.getVar('captured')).toBe(value)
        }),
        { numRuns: 15 }
      )
    })

    it('multiple traces on same variable all fire', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, (name, value) => {
          const rt = createRuntime()

          rt.run('set count1 0')
          rt.run('set count2 0')

          rt.run(`trace add variable ${name} {write} { incr count1 }`)
          rt.run(`trace add variable ${name} {write} { incr count2 }`)

          rt.run(`set ${name} {${value}}`)

          expect(rt.getVar('count1')).toBe('1')
          expect(rt.getVar('count2')).toBe('1')
        }),
        { numRuns: 15 }
      )
    })

    it('trace reentrancy guard prevents infinite recursion', () => {
      const rt = createRuntime()

      // Set up a trace that modifies a trace variable (_trace_name)
      // This would cause infinite recursion without the reentrancy guard
      rt.run('trace add variable x {write} { set _trace_name "modified" }')

      // Also add a trace on _trace_name itself to make it more complex
      rt.run('set trace_name_count 0')
      rt.run('trace add variable _trace_name {write} { incr trace_name_count }')

      // This should not cause infinite recursion
      expect(() => rt.run('set x value')).not.toThrow()

      // The trace on x should have fired, setting _trace_name
      expect(rt.getVar('_trace_name')).toBe('modified')

      // The trace on _trace_name should NOT have fired due to reentrancy guard
      expect(rt.getVar('trace_name_count')).toBe('0')
    })

    it('nested trace callbacks are prevented by reentrancy guard', () => {
      const rt = createRuntime()

      // Trace on 'a' that sets 'b' (which has its own trace)
      rt.run('set a_count 0')
      rt.run('set b_count 0')

      rt.run('trace add variable a {write} { set b "from_a"; incr a_count }')
      rt.run('trace add variable b {write} { incr b_count }')

      // Set 'a' - this should trigger a's trace which sets b
      rt.run('set a value')

      // a's trace should have fired
      expect(rt.getVar('a_count')).toBe('1')
      expect(rt.getVar('b')).toBe('from_a')

      // b's trace should NOT have fired due to reentrancy guard
      expect(rt.getVar('b_count')).toBe('0')
    })
  })

  describe('Combined Operations', () => {
    it('trace and unset work together', () => {
      fc.assert(
        fc.property(arbVarName, arbValue, (name, value) => {
          const rt = createRuntime()

          rt.run('set trace_fired 0')
          rt.run(`trace add variable ${name} {write} { incr trace_fired }`)

          rt.run(`set ${name} {${value}}`)
          expect(rt.getVar('trace_fired')).toBe('1')

          rt.run(`unset ${name}`)

          // Variable is gone
          expect(() => rt.getVar(name)).toThrow()

          // Trace might still fire on new set (depends on implementation)
          rt.run(`set ${name} new_value`)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('After Command', () => {
    it('after with script returns event id', () => {
      const rt = createRuntime()
      const id = rt.run('after 1000 { set x done }')
      expect(id).toMatch(/^after#\d+$/)
      // Clean up
      rt.run(`after cancel ${id}`)
    })

    it('after idle returns event id', () => {
      const rt = createRuntime()
      const id = rt.run('after idle { set x done }')
      expect(id).toMatch(/^after#\d+$/)
      // Clean up
      rt.run(`after cancel ${id}`)
    })

    it('after info lists all pending events', () => {
      const rt = createRuntime()
      const id1 = rt.run('after 10000 { set x 1 }')
      const id2 = rt.run('after 10000 { set x 2 }')

      const info = rt.run('after info')
      expect(info).toContain(id1)
      expect(info).toContain(id2)

      // Clean up
      rt.run(`after cancel ${id1}`)
      rt.run(`after cancel ${id2}`)
    })

    it('after cancel removes pending event', () => {
      const rt = createRuntime()
      const id = rt.run('after 10000 { set x done }')

      // Should be in pending list
      let info = rt.run('after info')
      expect(info).toContain(id)

      // Cancel it
      rt.run(`after cancel ${id}`)

      // Should no longer be in pending list
      info = rt.run('after info')
      expect(info).not.toContain(id)
    })

    it('after info with id returns script and type', () => {
      const rt = createRuntime()
      const id = rt.run('after 5000 { set done 1 }')

      const info = rt.run(`after info ${id}`)
      expect(info).toContain('set done 1')
      expect(info).toContain('timer')

      // Clean up
      rt.run(`after cancel ${id}`)
    })

    it('after idle info shows idle type', () => {
      const rt = createRuntime()
      const id = rt.run('after idle { set done 1 }')

      const info = rt.run(`after info ${id}`)
      expect(info).toContain('idle')

      // Clean up
      rt.run(`after cancel ${id}`)
    })

    it('after 0 executes script after yielding', async () => {
      const rt = createRuntime()
      rt.run('set executed 0')

      rt.run('after 0 { set executed 1 }')

      // Not executed immediately
      expect(rt.getVar('executed')).toBe('0')

      // Wait for event loop
      await new Promise(resolve => setTimeout(resolve, 10))

      // Now executed
      expect(rt.getVar('executed')).toBe('1')
    })

    it('after idle executes in microtask', async () => {
      const rt = createRuntime()
      rt.run('set executed 0')

      rt.run('after idle { set executed 1 }')

      // Wait for microtask
      await new Promise(resolve => queueMicrotask(resolve))

      expect(rt.getVar('executed')).toBe('1')
    })
  })

  describe('Vwait Command', () => {
    it('vwait returns promise', () => {
      const rt = createRuntime()
      rt.run('set done 0')
      const result = rt.run('vwait done')
      expect(result).toBeInstanceOf(Promise)
    })

    it('vwait resolves when variable is set', async () => {
      const rt = createRuntime()
      rt.run('set flag 0')

      // Start waiting
      const waitPromise = rt.run('vwait flag')

      // Set the variable after a small delay
      setTimeout(() => rt.run('set flag 1'), 5)

      // Wait for resolution
      const result = await waitPromise
      expect(result).toBe('1')
    })
  })

  describe('Update Command', () => {
    it('update returns a promise', () => {
      const rt = createRuntime()
      const result = rt.run('update')
      expect(result).toBeInstanceOf(Promise)
    })

    it('update idletasks returns a promise', () => {
      const rt = createRuntime()
      const result = rt.run('update idletasks')
      expect(result).toBeInstanceOf(Promise)
    })

    it('update yields to event loop', async () => {
      const rt = createRuntime()
      rt.run('set order {}')

      // Schedule some work
      setTimeout(() => rt.run('lappend order second'), 0)
      rt.run('lappend order first')

      // Before update, only 'first' is there
      expect(rt.getVar('order')).toBe('first')

      // Update yields to event loop
      await rt.run('update')

      // Now 'second' should be there
      expect(rt.getVar('order')).toBe('first second')
    })
  })
})
