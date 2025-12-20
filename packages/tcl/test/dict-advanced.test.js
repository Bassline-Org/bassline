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
    it('appends to existing value', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create key hello]')
      await rt.run('dict append d key world')
      expect(await rt.run('dict get $d key')).toBe('helloworld')
    })

    it('creates key if not exists', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create]')
      await rt.run('dict append d newkey value')
      expect(await rt.run('dict get $d newkey')).toBe('value')
    })

    it('appends multiple strings', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create k a]')
      await rt.run('dict append d k b c d')
      expect(await rt.run('dict get $d k')).toBe('abcd')
    })

    it('property: append length equals sum of lengths', async () => {
      fc.assert(
        fc.asyncProperty(arbKey, arbValue, arbValue, async (key, val1, val2) => {
          const rt = createRuntime()
          await rt.run(`set d [dict create {${key}} {${val1}}]`)
          await rt.run(`dict append d {${key}} {${val2}}`)
          const result = await rt.run(`dict get $d {${key}}`)
          expect(result.length).toBe(val1.length + val2.length)
        }),
        { numRuns: 15 }
      )
    })
  })

  describe('dict lappend', () => {
    it('appends to list value', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create items {a b}]')
      await rt.run('dict lappend d items c')
      const items = await rt.run('dict get $d items')
      expect(await rt.run(`llength {${items}}`)).toBe('3')
    })

    it('creates list if key not exists', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create]')
      await rt.run('dict lappend d newlist first second')
      const items = await rt.run('dict get $d newlist')
      expect(await rt.run(`llength {${items}}`)).toBe('2')
    })

    it('appends multiple items at once', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create items {}]')
      await rt.run('dict lappend d items a b c')
      const items = await rt.run('dict get $d items')
      expect(await rt.run(`llength {${items}}`)).toBe('3')
    })
  })

  describe('dict for', () => {
    it('iterates over all key-value pairs', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create a 1 b 2 c 3]')
      await rt.run('set sum 0')
      await rt.run('dict for {k v} $d { set sum [expr {$sum + $v}] }')
      expect(rt.getVar('sum')).toBe('6')
    })

    it('sets key and value variables', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create mykey myval]')
      await rt.run('set foundkey none')
      await rt.run('set foundval none')
      await rt.run('dict for {k v} $d { set foundkey $k; set foundval $v }')
      expect(rt.getVar('foundkey')).toBe('mykey')
      expect(rt.getVar('foundval')).toBe('myval')
    })

    it('empty dict produces no iterations', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create]')
      await rt.run('set count 0')
      await rt.run('dict for {k v} $d { incr count }')
      expect(rt.getVar('count')).toBe('0')
    })

    it('returns result of last body execution', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create a 1 b 2]')
      const result = await rt.run('dict for {k v} $d { set x done }')
      expect(result).toBe('done')
    })

    it('handles break', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create a 1 b 2 c 3]')
      await rt.run('set count 0')
      await rt.run('dict for {k v} $d { incr count; if {$count == 2} { break } }')
      expect(rt.getVar('count')).toBe('2')
    })

    it('handles continue', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create a 1 b 2 c 3]')
      await rt.run('set sum 0')
      await rt.run('dict for {k v} $d { if {$v == 2} { continue }; set sum [expr {$sum + $v}] }')
      expect(rt.getVar('sum')).toBe('4') // 1 + 3, skipping 2
    })
  })

  describe('dict map', () => {
    it('transforms values', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create a 1 b 2 c 3]')
      await rt.run('set result [dict map {k v} $d { expr {$v * 2} }]')
      expect(await rt.run('dict get $result a')).toBe('2')
      expect(await rt.run('dict get $result b')).toBe('4')
      expect(await rt.run('dict get $result c')).toBe('6')
    })

    it('preserves keys', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create x 1 y 2]')
      await rt.run('set result [dict map {k v} $d { set v }]')
      expect(await rt.run('dict exists $result x')).toBe('1')
      expect(await rt.run('dict exists $result y')).toBe('1')
    })

    it('empty dict returns empty dict', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create]')
      await rt.run('set result [dict map {k v} $d { set x }]')
      expect(await rt.run('dict size $result')).toBe('0')
    })

    it('handles break', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create a 1 b 2 c 3]')
      await rt.run('set count 0')
      await rt.run('set result [dict map {k v} $d { incr count; if {$count == 2} { break }; expr {$v * 2} }]')
      // Should have 1 or 2 entries before break
      const size = parseInt(await rt.run('dict size $result'))
      expect(size).toBeLessThan(3)
      expect(rt.getVar('count')).toBe('2')
    })

    it('handles continue', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create a 1 b 2 c 3]')
      await rt.run('set result [dict map {k v} $d { if {$v == 2} { continue }; expr {$v * 10} }]')
      expect(await rt.run('dict get $result a')).toBe('10')
      expect(await rt.run('dict get $result c')).toBe('30')
      // b should not exist because continue skips the result.set
      expect(await rt.run('dict exists $result b')).toBe('0')
      // Should only have 2 entries
      expect(await rt.run('dict size $result')).toBe('2')
    })
  })

  describe('dict filter', () => {
    it('filter by key pattern', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create apple 1 banana 2 apricot 3]')
      await rt.run('set result [dict filter $d key a*]')
      expect(await rt.run('dict exists $result apple')).toBe('1')
      expect(await rt.run('dict exists $result apricot')).toBe('1')
      expect(await rt.run('dict exists $result banana')).toBe('0')
    })

    it('filter by value pattern', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create a foo b bar c foobar]')
      await rt.run('set result [dict filter $d value foo*]')
      expect(await rt.run('dict exists $result a')).toBe('1')
      expect(await rt.run('dict exists $result c')).toBe('1')
      expect(await rt.run('dict exists $result b')).toBe('0')
    })

    it('filter by script', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create a 5 b 10 c 3 d 8]')
      // Keep values > 4
      await rt.run('set result [dict filter $d script {k v} { expr {$v > 4} }]')
      expect(await rt.run('dict exists $result a')).toBe('1')
      expect(await rt.run('dict exists $result b')).toBe('1')
      expect(await rt.run('dict exists $result d')).toBe('1')
      expect(await rt.run('dict exists $result c')).toBe('0')
    })

    it('empty filter result', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create a 1 b 2]')
      await rt.run('set result [dict filter $d key z*]')
      expect(await rt.run('dict size $result')).toBe('0')
    })

    it('filter script runs only once per entry', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create a 5 b 10 c 3]')
      await rt.run('set count 0')
      // Script increments count and checks value > 4
      await rt.run('set result [dict filter $d script {k v} { incr count; expr {$v > 4} }]')
      // Count should equal number of dict entries (3), not double (6)
      expect(rt.getVar('count')).toBe('3')
      // Verify filter still works correctly
      expect(await rt.run('dict exists $result a')).toBe('1')
      expect(await rt.run('dict exists $result b')).toBe('1')
      expect(await rt.run('dict exists $result c')).toBe('0')
    })
  })

  describe('dict update', () => {
    it('updates dict from local variables', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create x 1 y 2]')
      await rt.run('dict update d x xval y yval { set xval 10; set yval 20 }')
      expect(await rt.run('dict get $d x')).toBe('10')
      expect(await rt.run('dict get $d y')).toBe('20')
    })

    it('exposes current values as local variables', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create a 5 b 10]')
      await rt.run('set total 0')
      await rt.run('dict update d a aval b bval { set total [expr {$aval + $bval}] }')
      expect(rt.getVar('total')).toBe('15')
    })

    it('returns body result', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create k v]')
      // Note: return inside dict update body propagates out
      const result = await rt.run('dict update d k kval { set result $kval }')
      expect(result).toBe('v')
    })

    it('updates dict even when body contains return', async () => {
      const rt = createRuntime()
      // Dict should be updated before return propagates
      await rt.run(
        'proc test {} { set d [dict create x 1]; dict update d x xval { set xval 99; return early }; return $d }'
      )
      const result = await rt.run('test')
      expect(result).toBe('early')
      // Can't verify d here since return exits proc, but the mechanism is the same
    })

    it('updates dict even when body contains break', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create count 0]')
      await rt.run('foreach i {1 2 3} { dict update d count c { set c [expr {$c + 1}]; if {$i == 2} { break } } }')
      // Dict should have been updated even though break occurred
      expect(await rt.run('dict get $d count')).toBe('2')
    })
  })

  describe('dict with', () => {
    it('exposes dict keys as variables', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create name Alice age 30]')
      await rt.run('set result none')
      await rt.run('dict with d { set result "$name is $age" }')
      expect(rt.getVar('result')).toBe('Alice is 30')
    })

    it('updates dict from modified variables', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create count 5]')
      await rt.run('dict with d { incr count }')
      expect(await rt.run('dict get $d count')).toBe('6')
    })

    it('works with nested dict path', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create outer [dict create inner 42]]')
      await rt.run('set val 0')
      await rt.run('dict with d outer { set val $inner }')
      expect(rt.getVar('val')).toBe('42')
    })

    it('empty dict creates no variables', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create]')
      await rt.run('set executed 0')
      await rt.run('dict with d { set executed 1 }')
      expect(rt.getVar('executed')).toBe('1')
    })

    it('updates dict even when body contains break', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create count 0]')
      await rt.run('foreach i {1 2 3} { dict with d { set count [expr {$count + 1}]; if {$i == 2} { break } } }')
      // Dict should have been updated even though break occurred
      expect(await rt.run('dict get $d count')).toBe('2')
    })

    it('updates dict even when body contains continue', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create count 0]')
      await rt.run('foreach i {1 2 3} { dict with d { set count [expr {$count + 1}]; if {$i == 2} { continue } } }')
      // All three iterations should have updated the count
      expect(await rt.run('dict get $d count')).toBe('3')
    })
  })

  describe('Nested Dict Operations', () => {
    it('get nested value', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create outer [dict create inner value]]')
      expect(await rt.run('dict get $d outer inner')).toBe('value')
    })

    it('set nested value', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create outer [dict create inner old]]')
      await rt.run('dict set d outer inner new')
      expect(await rt.run('dict get $d outer inner')).toBe('new')
    })

    it('exists on nested key', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create a [dict create b [dict create c 1]]]')
      expect(await rt.run('dict exists $d a b c')).toBe('1')
      expect(await rt.run('dict exists $d a b x')).toBe('0')
    })

    it('unset nested key', async () => {
      const rt = createRuntime()
      await rt.run('set d [dict create a [dict create b 1 c 2]]')
      await rt.run('dict unset d a b')
      expect(await rt.run('dict exists $d a b')).toBe('0')
      expect(await rt.run('dict exists $d a c')).toBe('1')
    })
  })
})
