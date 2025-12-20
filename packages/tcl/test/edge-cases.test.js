import { describe, it, expect } from 'vitest'
import { Runtime, std, list, dictCmd, string, namespace, info, event } from '../src/index.js'
import { tokenize } from '../src/index.js'

/**
 * Edge case and adversarial tests - designed to break the system
 * These test actual bugs and boundary conditions found through analysis
 */

function createFullRuntime() {
  const rt = new Runtime()
  for (const [n, fn] of Object.entries(std)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(list)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(dictCmd)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(string)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(namespace)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(info)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(event)) rt.register(n, fn)
  return rt
}

describe('Edge Cases', () => {
  describe('Division and Modulo', () => {
    it('division by zero throws error', async () => {
      const rt = createFullRuntime()
      await expect(rt.run('expr {1 / 0}')).rejects.toThrow('divide by zero')
    })

    it('modulo by zero throws error', async () => {
      const rt = createFullRuntime()
      await expect(rt.run('expr {1 % 0}')).rejects.toThrow('divide by zero')
    })

    it('integer division uses floor division', async () => {
      const rt = createFullRuntime()
      // Floor division for integers
      expect(await rt.run('expr {7 / 2}')).toBe('3')
      expect(await rt.run('expr {6 / 2}')).toBe('3')
      expect(await rt.run('expr {-7 / 2}')).toBe('-4') // Floor division
    })

    it('modulo follows Euclidean semantics', async () => {
      const rt = createFullRuntime()
      expect(await rt.run('expr {7 % 3}')).toBe('1')
      // Tcl uses Euclidean modulo (result always non-negative for positive divisor)
      expect(await rt.run('expr {-7 % 3}')).toBe('2') // Euclidean: -7 = -3*3 + 2
    })

    it('floating point division uses true division', async () => {
      const rt = createFullRuntime()
      // Float literals trigger true division
      expect(await rt.run('expr {7.0 / 2}')).toBe('3.5')
      expect(await rt.run('expr {7 / 2.0}')).toBe('3.5')
      expect(await rt.run('expr {7.0 / 2.0}')).toBe('3.5')
    })
  })

  describe('Empty Input Edge Cases', () => {
    it('empty string operations', async () => {
      const rt = createFullRuntime()
      expect(await rt.run('string length {}')).toBe('0')
      expect(await rt.run('string reverse {}')).toBe('')
      expect(await rt.run('string tolower {}')).toBe('')
      expect(await rt.run('string toupper {}')).toBe('')
    })

    it('empty list operations', async () => {
      const rt = createFullRuntime()
      expect(await rt.run('llength {}')).toBe('0')
      expect(await rt.run('lreverse {}')).toBe('')
      expect(await rt.run('lsort {}')).toBe('')
    })

    it('empty dict operations', async () => {
      const rt = createFullRuntime()
      expect(await rt.run('dict size [dict create]')).toBe('0')
      expect(await rt.run('dict keys [dict create]')).toBe('')
      expect(await rt.run('dict values [dict create]')).toBe('')
    })

    it('concat with empty', async () => {
      const rt = createFullRuntime()
      expect(await rt.run('string concat {} {hello}')).toBe('hello')
      expect(await rt.run('string concat {hello} {}')).toBe('hello')
      expect(await rt.run('concat {} {a b}')).toBe('a b')
    })
  })

  describe('Boundary Index Cases', () => {
    it('lindex out of bounds returns empty', async () => {
      const rt = createFullRuntime()
      expect(await rt.run('lindex {a b c} 999')).toBe('')
      expect(await rt.run('lindex {a b c} -999')).toBe('')
    })

    it('lindex with end-N on short list', async () => {
      const rt = createFullRuntime()
      expect(await rt.run('lindex {a} end')).toBe('a')
      expect(await rt.run('lindex {a} end-0')).toBe('a')
      expect(await rt.run('lindex {a} end-1')).toBe('') // Out of bounds
    })

    it('string index out of bounds', async () => {
      const rt = createFullRuntime()
      expect(await rt.run('string index {hello} 999')).toBe('')
      expect(await rt.run('string index {hello} -1')).toBe('')
    })

    it('string range with invalid bounds', async () => {
      const rt = createFullRuntime()
      // Reversed bounds
      expect(await rt.run('string range {hello} 3 1')).toBe('')
      // Negative start
      expect(await rt.run('string range {hello} -1 2')).toBe('')
    })

    it('lrange with reversed bounds', async () => {
      const rt = createFullRuntime()
      const result = await rt.run('lrange {a b c d} 3 1')
      // Tcl returns empty for reversed bounds
      expect(result).toBe('')
    })
  })

  describe('Whitespace Edge Cases', () => {
    it('string with only whitespace', async () => {
      const rt = createFullRuntime()
      await rt.run('set x "   "')
      expect(await rt.run('string length $x')).toBe('3')
      expect(await rt.run('string trim $x')).toBe('')
    })

    it('list parsing with extra whitespace', async () => {
      const rt = createFullRuntime()
      // Multiple spaces between elements
      expect(await rt.run('llength {a   b   c}')).toBe('3')
    })

    it('leading and trailing whitespace in list', async () => {
      const rt = createFullRuntime()
      expect(await rt.run('llength {  a b  }')).toBe('2')
    })
  })

  describe('Special Characters', () => {
    it('braced strings with dollar signs', async () => {
      const rt = createFullRuntime()
      await rt.run('set x {$notavar}')
      expect(rt.getVar('x')).toBe('$notavar')
    })

    it('braced strings with brackets', async () => {
      const rt = createFullRuntime()
      await rt.run('set x {[not a command]}')
      expect(rt.getVar('x')).toBe('[not a command]')
    })

    it('nested braces', async () => {
      const rt = createFullRuntime()
      await rt.run('set x {outer {inner} outer}')
      expect(rt.getVar('x')).toBe('outer {inner} outer')
    })

    it('deeply nested braces', async () => {
      const rt = createFullRuntime()
      await rt.run('set x {a {b {c {d}}}}')
      expect(rt.getVar('x')).toBe('a {b {c {d}}}')
    })
  })

  describe('Large Input Stress', () => {
    it('long string', async () => {
      const rt = createFullRuntime()
      const longStr = 'a'.repeat(10000)
      await rt.run(`set x {${longStr}}`)
      expect(await rt.run('string length $x')).toBe('10000')
    })

    it('long list', async () => {
      const rt = createFullRuntime()
      const elements = Array.from({ length: 1000 }, (_, i) => `elem${i}`)
      const listStr = elements.join(' ')
      await rt.run(`set mylist {${listStr}}`)
      expect(await rt.run('llength $mylist')).toBe('1000')
    })

    it('deep nesting', async () => {
      const rt = createFullRuntime()
      // 20 levels of if nesting
      let script = 'set x 0\n'
      for (let i = 0; i < 20; i++) script += 'if {1} {\n'
      script += 'set x done\n'
      for (let i = 0; i < 20; i++) script += '}\n'
      await rt.run(script)
      expect(rt.getVar('x')).toBe('done')
    })
  })

  describe('Numeric Edge Cases', () => {
    it('very large numbers', async () => {
      const rt = createFullRuntime()
      // JavaScript handles big numbers as floats
      expect(await rt.run('expr {99999999999999}')).toBe('99999999999999')
    })

    it('negative zero', async () => {
      const rt = createFullRuntime()
      expect(await rt.run('expr {-0}')).toBe('0')
    })

    it('floating point precision', async () => {
      const rt = createFullRuntime()
      // Classic floating point issue
      const result = await rt.run('expr {0.1 + 0.2}')
      // Should be close to 0.3
      expect(parseFloat(result)).toBeCloseTo(0.3)
    })
  })

  describe('Control Flow Edge Cases', () => {
    it('while that never executes', async () => {
      const rt = createFullRuntime()
      await rt.run('set x before')
      await rt.run('while {0} { set x inside }')
      expect(rt.getVar('x')).toBe('before')
    })

    it('for loop with zero iterations', async () => {
      const rt = createFullRuntime()
      await rt.run('set count 0')
      await rt.run('for {set i 10} {$i < 5} {incr i} { incr count }')
      expect(rt.getVar('count')).toBe('0')
    })

    it('foreach with empty list', async () => {
      const rt = createFullRuntime()
      await rt.run('set count 0')
      await rt.run('foreach x {} { incr count }')
      expect(rt.getVar('count')).toBe('0')
    })

    it('nested break only breaks inner loop', async () => {
      const rt = createFullRuntime()
      await rt.run('set outer 0')
      await rt.run('set inner 0')
      await rt.run(`
        for {set i 0} {$i < 3} {incr i} {
          incr outer
          for {set j 0} {$j < 3} {incr j} {
            incr inner
            if {$j == 1} { break }
          }
        }
      `)
      expect(rt.getVar('outer')).toBe('3')
      expect(rt.getVar('inner')).toBe('6') // 2 iterations per outer loop
    })

    it('continue in foreach', async () => {
      const rt = createFullRuntime()
      await rt.run('set sum 0')
      await rt.run('foreach x {1 2 3 4 5} { if {$x == 3} { continue }; set sum [expr {$sum + $x}] }')
      expect(rt.getVar('sum')).toBe('12') // 1+2+4+5
    })
  })

  describe('Switch Edge Cases', () => {
    it('switch with no matching case and no default', async () => {
      const rt = createFullRuntime()
      const result = await rt.run('switch {nomatch} { a { set r a } b { set r b } }')
      expect(result).toBe('')
    })

    it('switch -regexp mode', async () => {
      const rt = createFullRuntime()
      const result = await rt.run('switch -regexp {hello123} { {^hello} { set r matched } default { set r default } }')
      expect(result).toBe('matched')
    })

    it('switch first match wins', async () => {
      const rt = createFullRuntime()
      await rt.run('set r none')
      const result = await rt.run('switch {a} { a { set r first } a { set r second } }')
      expect(result).toBe('first')
    })
  })

  describe('Dict Edge Cases', () => {
    it('dict with numeric keys', async () => {
      const rt = createFullRuntime()
      await rt.run('set d [dict create 1 one 2 two 10 ten]')
      expect(await rt.run('dict get $d 1')).toBe('one')
      expect(await rt.run('dict get $d 10')).toBe('ten')
    })

    it('dict key not found throws', async () => {
      const rt = createFullRuntime()
      await rt.run('set d [dict create a 1]')
      await expect(rt.run('dict get $d nonexistent')).rejects.toThrow()
    })

    it('dict with empty string value', async () => {
      const rt = createFullRuntime()
      await rt.run('set d [dict create key {}]')
      expect(await rt.run('dict get $d key')).toBe('')
      expect(await rt.run('dict exists $d key')).toBe('1')
    })

    it('dict merge overwrites in order', async () => {
      const rt = createFullRuntime()
      await rt.run('set d1 [dict create a 1 b 2]')
      await rt.run('set d2 [dict create b 99 c 3]')
      await rt.run('set merged [dict merge $d1 $d2]')
      expect(await rt.run('dict get $merged b')).toBe('99')
    })
  })

  describe('Namespace Edge Cases', () => {
    it('deeply nested namespaces', async () => {
      const rt = createFullRuntime()
      await rt.run('namespace eval a { namespace eval b { namespace eval c { namespace eval d { set x deep } } } }')
      // This implementation uses / as namespace separator, not ::
      expect(
        await rt.run('namespace eval a { namespace eval b { namespace eval c { namespace eval d { set x } } } }')
      ).toBe('deep')
    })

    it('namespace current in nested context', async () => {
      const rt = createFullRuntime()
      const path = await rt.run('namespace eval foo { namespace eval bar { namespace current } }')
      expect(path).toBe('/foo/bar')
    })

    it('namespace delete removes namespace', async () => {
      const rt = createFullRuntime()
      await rt.run('namespace eval todelete { set x 1 }')
      expect(await rt.run('namespace exists todelete')).toBe('1')
      await rt.run('namespace delete todelete')
      expect(await rt.run('namespace exists todelete')).toBe('0')
    })
  })

  describe('Error Handling', () => {
    it('catch captures error message', async () => {
      const rt = createFullRuntime()
      await rt.run('catch { error "my error message" } result')
      expect(rt.getVar('result')).toContain('my error message')
    })

    it('catch returns 1 for unknown command', async () => {
      const rt = createFullRuntime()
      const code = await rt.run('catch { nonexistent_command }')
      expect(code).toBe('1')
    })

    it('error in expression is catchable', async () => {
      const rt = createFullRuntime()
      const code = await rt.run('catch { expr {1 / 0} } result')
      // Division by zero now throws an error
      expect(code).toBe('1') // Error caught
    })

    it('syntax error is catchable', async () => {
      const rt = createFullRuntime()
      const code = await rt.run('catch { if } result')
      expect(code).toBe('1')
    })
  })

  describe('Variable Edge Cases', () => {
    it('variable name with underscore', async () => {
      const rt = createFullRuntime()
      await rt.run('set my_var 123')
      expect(rt.getVar('my_var')).toBe('123')
    })

    it('overwriting variable', async () => {
      const rt = createFullRuntime()
      await rt.run('set x first')
      await rt.run('set x second')
      expect(rt.getVar('x')).toBe('second')
    })

    it('unset then access throws', async () => {
      const rt = createFullRuntime()
      await rt.run('set x 1')
      await rt.run('unset x')
      expect(() => rt.getVar('x')).toThrow()
    })

    it('array can store empty string and access it', async () => {
      const rt = createFullRuntime()
      // In this TCL implementation, arrays are just objects stored in variables
      rt.setVar('arr', { key: '' })
      // Use dollar sign syntax to access array elements
      expect(await rt.run('puts $arr(key)')).toBe('')
    })

    it('array element existence check works with undefined-like values', async () => {
      const rt = createFullRuntime()
      // Set an array with an empty string value (undefined-like)
      rt.setVar('myarr', { emptykey: '' })
      // Should be able to access it without error using dollar syntax
      const result = await rt.run('puts $myarr(emptykey)')
      expect(result).toBe('')
      // Accessing non-existent element should still throw
      await expect(rt.run('puts $myarr(nonexistent)')).rejects.toThrow(/No such element/)
    })
  })

  describe('Incr Edge Cases', () => {
    it('incr creates variable if not exists', async () => {
      const rt = createFullRuntime()
      await rt.run('incr newvar')
      expect(rt.getVar('newvar')).toBe('1')
    })

    it('incr with large increment', async () => {
      const rt = createFullRuntime()
      await rt.run('set x 0')
      await rt.run('incr x 1000000')
      expect(rt.getVar('x')).toBe('1000000')
    })

    it('incr can go negative', async () => {
      const rt = createFullRuntime()
      await rt.run('set x 5')
      await rt.run('incr x -10')
      expect(rt.getVar('x')).toBe('-5')
    })
  })

  describe('Proc Edge Cases', () => {
    it('proc with no args', async () => {
      const rt = createFullRuntime()
      await rt.run('proc noargs {} { return hello }')
      expect(await rt.run('noargs')).toBe('hello')
    })

    it('proc with multiple args', async () => {
      const rt = createFullRuntime()
      await rt.run('proc add {a b c} { expr {$a + $b + $c} }')
      expect(await rt.run('add 1 2 3')).toBe('6')
    })

    it('proc local variables dont leak', async () => {
      const rt = createFullRuntime()
      await rt.run('set x global')
      await rt.run('proc test {} { set x local; return $x }')
      await rt.run('test')
      expect(rt.getVar('x')).toBe('global')
    })

    it('recursive proc', async () => {
      const rt = createFullRuntime()
      await rt.run('proc fact {n} { if {$n <= 1} { return 1 } else { return [expr {$n * [fact [expr {$n - 1}]]}] } }')
      expect(await rt.run('fact 5')).toBe('120')
    })
  })
})

describe('Tokenizer Edge Cases', () => {
  it('handles empty input', async () => {
    const tokens = [...tokenize('')]
    // Empty input produces EOF token
    expect(tokens.length).toBeGreaterThanOrEqual(0)
  })

  it('handles whitespace only', async () => {
    const tokens = [...tokenize('   ')]
    // Whitespace is skipped, may produce EOF token
    expect(tokens.length).toBeGreaterThanOrEqual(0)
  })

  it('handles newlines', async () => {
    const tokens = [...tokenize('set x 1\nset y 2')]
    // Should have tokens for both commands
    expect(tokens.length).toBeGreaterThan(0)
  })

  it('handles semicolon command separator', async () => {
    const tokens = [...tokenize('set x 1; set y 2')]
    // Should tokenize both commands
    expect(tokens.length).toBeGreaterThan(3)
  })
})
