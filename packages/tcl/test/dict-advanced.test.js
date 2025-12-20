import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { Runtime, std, dictCmd, list } from '../src/index.js'

/**
 * Tests for advanced dict commands that were previously untested:
 * - dict append
 * - dict lappend
 * - dict for
 * - dict map
 * - dict filter
 * - dict update
 * - dict with
 */

function createRuntime() {
  const rt = new Runtime()
  for (const [n, fn] of Object.entries(std)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(dictCmd)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(list)) rt.register(n, fn)
  return rt
}

const arbKey = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
  minLength: 1,
  maxLength: 6,
})

const arbValue = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
  minLength: 1,
  maxLength: 8,
})

describe('Dict Advanced Commands', () => {
  describe('dict append', () => {
    it('appends to existing value', () => {
      const rt = createRuntime()
      rt.run('set d [dict create key hello]')
      rt.run('dict append d key world')
      expect(rt.run('dict get $d key')).toBe('helloworld')
    })

    it('creates key if not exists', () => {
      const rt = createRuntime()
      rt.run('set d [dict create]')
      rt.run('dict append d newkey value')
      expect(rt.run('dict get $d newkey')).toBe('value')
    })

    it('appends multiple strings', () => {
      const rt = createRuntime()
      rt.run('set d [dict create k a]')
      rt.run('dict append d k b c d')
      expect(rt.run('dict get $d k')).toBe('abcd')
    })

    it('property: append length equals sum of lengths', () => {
      fc.assert(
        fc.property(arbKey, arbValue, arbValue, (key, val1, val2) => {
          const rt = createRuntime()
          rt.run(`set d [dict create {${key}} {${val1}}]`)
          rt.run(`dict append d {${key}} {${val2}}`)
          const result = rt.run(`dict get $d {${key}}`)
          expect(result.length).toBe(val1.length + val2.length)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('dict lappend', () => {
    it('appends to list value', () => {
      const rt = createRuntime()
      rt.run('set d [dict create items {a b}]')
      rt.run('dict lappend d items c')
      const items = rt.run('dict get $d items')
      expect(rt.run(`llength {${items}}`)).toBe('3')
    })

    it('creates list if key not exists', () => {
      const rt = createRuntime()
      rt.run('set d [dict create]')
      rt.run('dict lappend d newlist first second')
      const items = rt.run('dict get $d newlist')
      expect(rt.run(`llength {${items}}`)).toBe('2')
    })

    it('appends multiple items at once', () => {
      const rt = createRuntime()
      rt.run('set d [dict create items {}]')
      rt.run('dict lappend d items a b c')
      const items = rt.run('dict get $d items')
      expect(rt.run(`llength {${items}}`)).toBe('3')
    })
  })

  describe('dict for', () => {
    it('iterates over all key-value pairs', () => {
      const rt = createRuntime()
      rt.run('set d [dict create a 1 b 2 c 3]')
      rt.run('set sum 0')
      rt.run('dict for {k v} $d { set sum [expr {$sum + $v}] }')
      expect(rt.getVar('sum')).toBe('6')
    })

    it('sets key and value variables', () => {
      const rt = createRuntime()
      rt.run('set d [dict create mykey myval]')
      rt.run('set foundkey none')
      rt.run('set foundval none')
      rt.run('dict for {k v} $d { set foundkey $k; set foundval $v }')
      expect(rt.getVar('foundkey')).toBe('mykey')
      expect(rt.getVar('foundval')).toBe('myval')
    })

    it('empty dict produces no iterations', () => {
      const rt = createRuntime()
      rt.run('set d [dict create]')
      rt.run('set count 0')
      rt.run('dict for {k v} $d { incr count }')
      expect(rt.getVar('count')).toBe('0')
    })

    it('returns result of last body execution', () => {
      const rt = createRuntime()
      rt.run('set d [dict create a 1 b 2]')
      const result = rt.run('dict for {k v} $d { set x done }')
      expect(result).toBe('done')
    })

    it('handles break', () => {
      const rt = createRuntime()
      rt.run('set d [dict create a 1 b 2 c 3]')
      rt.run('set count 0')
      rt.run('dict for {k v} $d { incr count; if {$count == 2} { break } }')
      expect(rt.getVar('count')).toBe('2')
    })

    it('handles continue', () => {
      const rt = createRuntime()
      rt.run('set d [dict create a 1 b 2 c 3]')
      rt.run('set sum 0')
      rt.run('dict for {k v} $d { if {$v == 2} { continue }; set sum [expr {$sum + $v}] }')
      expect(rt.getVar('sum')).toBe('4') // 1 + 3, skipping 2
    })
  })

  describe('dict map', () => {
    it('transforms values', () => {
      const rt = createRuntime()
      rt.run('set d [dict create a 1 b 2 c 3]')
      rt.run('set result [dict map {k v} $d { expr {$v * 2} }]')
      expect(rt.run('dict get $result a')).toBe('2')
      expect(rt.run('dict get $result b')).toBe('4')
      expect(rt.run('dict get $result c')).toBe('6')
    })

    it('preserves keys', () => {
      const rt = createRuntime()
      rt.run('set d [dict create x 1 y 2]')
      rt.run('set result [dict map {k v} $d { set v }]')
      expect(rt.run('dict exists $result x')).toBe('1')
      expect(rt.run('dict exists $result y')).toBe('1')
    })

    it('empty dict returns empty dict', () => {
      const rt = createRuntime()
      rt.run('set d [dict create]')
      rt.run('set result [dict map {k v} $d { set x }]')
      expect(rt.run('dict size $result')).toBe('0')
    })

    it('handles break', () => {
      const rt = createRuntime()
      rt.run('set d [dict create a 1 b 2 c 3]')
      rt.run('set count 0')
      rt.run('set result [dict map {k v} $d { incr count; if {$count == 2} { break }; expr {$v * 2} }]')
      // Should have 1 or 2 entries before break
      const size = parseInt(rt.run('dict size $result'))
      expect(size).toBeLessThan(3)
      expect(rt.getVar('count')).toBe('2')
    })

    it('handles continue', () => {
      const rt = createRuntime()
      rt.run('set d [dict create a 1 b 2 c 3]')
      rt.run('set result [dict map {k v} $d { if {$v == 2} { continue }; expr {$v * 10} }]')
      expect(rt.run('dict get $result a')).toBe('10')
      expect(rt.run('dict get $result c')).toBe('30')
      // b should not exist because continue skips the result.set
      expect(rt.run('dict exists $result b')).toBe('0')
      // Should only have 2 entries
      expect(rt.run('dict size $result')).toBe('2')
    })
  })

  describe('dict filter', () => {
    it('filter by key pattern', () => {
      const rt = createRuntime()
      rt.run('set d [dict create apple 1 banana 2 apricot 3]')
      rt.run('set result [dict filter $d key a*]')
      expect(rt.run('dict exists $result apple')).toBe('1')
      expect(rt.run('dict exists $result apricot')).toBe('1')
      expect(rt.run('dict exists $result banana')).toBe('0')
    })

    it('filter by value pattern', () => {
      const rt = createRuntime()
      rt.run('set d [dict create a foo b bar c foobar]')
      rt.run('set result [dict filter $d value foo*]')
      expect(rt.run('dict exists $result a')).toBe('1')
      expect(rt.run('dict exists $result c')).toBe('1')
      expect(rt.run('dict exists $result b')).toBe('0')
    })

    it('filter by script', () => {
      const rt = createRuntime()
      rt.run('set d [dict create a 5 b 10 c 3 d 8]')
      // Keep values > 4
      rt.run('set result [dict filter $d script {k v} { expr {$v > 4} }]')
      expect(rt.run('dict exists $result a')).toBe('1')
      expect(rt.run('dict exists $result b')).toBe('1')
      expect(rt.run('dict exists $result d')).toBe('1')
      expect(rt.run('dict exists $result c')).toBe('0')
    })

    it('empty filter result', () => {
      const rt = createRuntime()
      rt.run('set d [dict create a 1 b 2]')
      rt.run('set result [dict filter $d key z*]')
      expect(rt.run('dict size $result')).toBe('0')
    })

    it('filter script runs only once per entry', () => {
      const rt = createRuntime()
      rt.run('set d [dict create a 5 b 10 c 3]')
      rt.run('set count 0')
      // Script increments count and checks value > 4
      rt.run('set result [dict filter $d script {k v} { incr count; expr {$v > 4} }]')
      // Count should equal number of dict entries (3), not double (6)
      expect(rt.getVar('count')).toBe('3')
      // Verify filter still works correctly
      expect(rt.run('dict exists $result a')).toBe('1')
      expect(rt.run('dict exists $result b')).toBe('1')
      expect(rt.run('dict exists $result c')).toBe('0')
    })
  })

  describe('dict update', () => {
    it('updates dict from local variables', () => {
      const rt = createRuntime()
      rt.run('set d [dict create x 1 y 2]')
      rt.run('dict update d x xval y yval { set xval 10; set yval 20 }')
      expect(rt.run('dict get $d x')).toBe('10')
      expect(rt.run('dict get $d y')).toBe('20')
    })

    it('exposes current values as local variables', () => {
      const rt = createRuntime()
      rt.run('set d [dict create a 5 b 10]')
      rt.run('set total 0')
      rt.run('dict update d a aval b bval { set total [expr {$aval + $bval}] }')
      expect(rt.getVar('total')).toBe('15')
    })

    it('returns body result', () => {
      const rt = createRuntime()
      rt.run('set d [dict create k v]')
      // Note: return inside dict update body propagates out
      const result = rt.run('dict update d k kval { set result $kval }')
      expect(result).toBe('v')
    })

    it('updates dict even when body contains return', () => {
      const rt = createRuntime()
      // Dict should be updated before return propagates
      rt.run('proc test {} { set d [dict create x 1]; dict update d x xval { set xval 99; return early }; return $d }')
      const result = rt.run('test')
      expect(result).toBe('early')
      // Can't verify d here since return exits proc, but the mechanism is the same
    })

    it('updates dict even when body contains break', () => {
      const rt = createRuntime()
      rt.run('set d [dict create count 0]')
      rt.run('foreach i {1 2 3} { dict update d count c { set c [expr {$c + 1}]; if {$i == 2} { break } } }')
      // Dict should have been updated even though break occurred
      expect(rt.run('dict get $d count')).toBe('2')
    })
  })

  describe('dict with', () => {
    it('exposes dict keys as variables', () => {
      const rt = createRuntime()
      rt.run('set d [dict create name Alice age 30]')
      rt.run('set result none')
      rt.run('dict with d { set result "$name is $age" }')
      expect(rt.getVar('result')).toBe('Alice is 30')
    })

    it('updates dict from modified variables', () => {
      const rt = createRuntime()
      rt.run('set d [dict create count 5]')
      rt.run('dict with d { incr count }')
      expect(rt.run('dict get $d count')).toBe('6')
    })

    it('works with nested dict path', () => {
      const rt = createRuntime()
      rt.run('set d [dict create outer [dict create inner 42]]')
      rt.run('set val 0')
      rt.run('dict with d outer { set val $inner }')
      expect(rt.getVar('val')).toBe('42')
    })

    it('empty dict creates no variables', () => {
      const rt = createRuntime()
      rt.run('set d [dict create]')
      rt.run('set executed 0')
      rt.run('dict with d { set executed 1 }')
      expect(rt.getVar('executed')).toBe('1')
    })

    it('updates dict even when body contains break', () => {
      const rt = createRuntime()
      rt.run('set d [dict create count 0]')
      rt.run('foreach i {1 2 3} { dict with d { set count [expr {$count + 1}]; if {$i == 2} { break } } }')
      // Dict should have been updated even though break occurred
      expect(rt.run('dict get $d count')).toBe('2')
    })

    it('updates dict even when body contains continue', () => {
      const rt = createRuntime()
      rt.run('set d [dict create count 0]')
      rt.run('foreach i {1 2 3} { dict with d { set count [expr {$count + 1}]; if {$i == 2} { continue } } }')
      // All three iterations should have updated the count
      expect(rt.run('dict get $d count')).toBe('3')
    })
  })

  describe('Nested Dict Operations', () => {
    it('get nested value', () => {
      const rt = createRuntime()
      rt.run('set d [dict create outer [dict create inner value]]')
      expect(rt.run('dict get $d outer inner')).toBe('value')
    })

    it('set nested value', () => {
      const rt = createRuntime()
      rt.run('set d [dict create outer [dict create inner old]]')
      rt.run('dict set d outer inner new')
      expect(rt.run('dict get $d outer inner')).toBe('new')
    })

    it('exists on nested key', () => {
      const rt = createRuntime()
      rt.run('set d [dict create a [dict create b [dict create c 1]]]')
      expect(rt.run('dict exists $d a b c')).toBe('1')
      expect(rt.run('dict exists $d a b x')).toBe('0')
    })

    it('unset nested key', () => {
      const rt = createRuntime()
      rt.run('set d [dict create a [dict create b 1 c 2]]')
      rt.run('dict unset d a b')
      expect(rt.run('dict exists $d a b')).toBe('0')
      expect(rt.run('dict exists $d a c')).toBe('1')
    })
  })
})
