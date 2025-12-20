import { describe, it, expect } from 'vitest'
import { Runtime, std, dictCmd, list } from '../src/index.js'
import { globToRegex } from '../src/glob.js'

function createRuntime() {
  const rt = new Runtime()
  for (const [n, fn] of Object.entries(std)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(dictCmd)) rt.register(n, fn)
  for (const [n, fn] of Object.entries(list)) rt.register(n, fn)
  return rt
}

describe('Glob Pattern Tests', () => {
  describe('globToRegex', () => {
    it('handles basic wildcards', async () => {
      expect(globToRegex('*').test('anything')).toBe(true)
      expect(globToRegex('*').test('')).toBe(true)
      expect(globToRegex('a*').test('abc')).toBe(true)
      expect(globToRegex('a*').test('a')).toBe(true)
      expect(globToRegex('a*').test('bc')).toBe(false)

      expect(globToRegex('?').test('a')).toBe(true)
      expect(globToRegex('?').test('ab')).toBe(false)
      expect(globToRegex('?').test('')).toBe(false)
      expect(globToRegex('a?c').test('abc')).toBe(true)
      expect(globToRegex('a?c').test('ac')).toBe(false)
    })

    it('treats dots as literal', async () => {
      // The bug: a.b should NOT match aXb
      expect(globToRegex('a.b').test('a.b')).toBe(true)
      expect(globToRegex('a.b').test('aXb')).toBe(false)
      expect(globToRegex('a.b').test('abb')).toBe(false)
      expect(globToRegex('a.b').test('a_b')).toBe(false)

      // Multiple dots
      expect(globToRegex('a.b.c').test('a.b.c')).toBe(true)
      expect(globToRegex('a.b.c').test('aXbXc')).toBe(false)
    })

    it('treats plus signs as literal', async () => {
      expect(globToRegex('a+b').test('a+b')).toBe(true)
      expect(globToRegex('a+b').test('ab')).toBe(false)
      expect(globToRegex('a+b').test('aab')).toBe(false)
      expect(globToRegex('a+b').test('aaab')).toBe(false)
    })

    it('treats other regex metacharacters as literal', async () => {
      // Carets
      expect(globToRegex('a^b').test('a^b')).toBe(true)
      expect(globToRegex('a^b').test('ab')).toBe(false)

      // Dollar signs
      expect(globToRegex('a$b').test('a$b')).toBe(true)
      expect(globToRegex('a$b').test('ab')).toBe(false)

      // Parentheses
      expect(globToRegex('a(b)').test('a(b)')).toBe(true)
      expect(globToRegex('a(b)').test('ab')).toBe(false)

      // Brackets
      expect(globToRegex('a[b]').test('a[b]')).toBe(true)
      expect(globToRegex('a[b]').test('ab')).toBe(false)

      // Braces
      expect(globToRegex('a{b}').test('a{b}')).toBe(true)
      expect(globToRegex('a{b}').test('ab')).toBe(false)

      // Pipes
      expect(globToRegex('a|b').test('a|b')).toBe(true)
      expect(globToRegex('a|b').test('a')).toBe(false)
      expect(globToRegex('a|b').test('b')).toBe(false)

      // Backslashes
      expect(globToRegex('a\\b').test('a\\b')).toBe(true)
    })

    it('handles combined wildcards and metacharacters', async () => {
      // Wildcard with dot
      expect(globToRegex('*.txt').test('file.txt')).toBe(true)
      expect(globToRegex('*.txt').test('.txt')).toBe(true)
      expect(globToRegex('*.txt').test('fileXtxt')).toBe(false)
      expect(globToRegex('*.txt').test('file.text')).toBe(false)

      // Question mark with dot
      expect(globToRegex('a?.txt').test('ab.txt')).toBe(true)
      expect(globToRegex('a?.txt').test('a.txt')).toBe(false)
      expect(globToRegex('a?.txt').test('abX.txt')).toBe(false)

      // Multiple metacharacters with wildcards
      expect(globToRegex('test.*.js').test('test.foo.js')).toBe(true)
      expect(globToRegex('test.*.js').test('testXfooXjs')).toBe(false)
    })
  })

  describe('switch -glob with dots', () => {
    it('does not match dot as wildcard', async () => {
      const rt = createRuntime()

      // Bug case: a.b should not match aXb
      const result1 = await rt.run('switch -glob aXb { a.b { set x MATCH } default { set x NOMATCH } }; set x')
      expect(result1).toBe('NOMATCH')

      const result2 = await rt.run('switch -glob a.b { a.b { set x MATCH } default { set x NOMATCH } }; set x')
      expect(result2).toBe('MATCH')
    })

    it('works with wildcards and dots', async () => {
      const rt = createRuntime()

      const result3 = await rt.run('switch -glob test.js { *.js { set x MATCH } default { set x NOMATCH } }; set x')
      expect(result3).toBe('MATCH')

      const result4 = await rt.run('switch -glob testXjs { *.js { set x MATCH } default { set x NOMATCH } }; set x')
      expect(result4).toBe('NOMATCH')
    })
  })

  describe('lsearch -glob with dots', () => {
    it('does not match dot as wildcard', async () => {
      const rt = createRuntime()

      // Bug case: a.b pattern should not match aXb
      await rt.run('set list {a.b aXb aBb}')
      const result1 = await rt.run('lsearch -glob $list a.b')
      expect(result1).toBe('0') // Should find a.b at index 0

      await rt.run('set list {aXb aBb}')
      const result2 = await rt.run('lsearch -glob $list a.b')
      expect(result2).toBe('-1') // Should not find anything
    })

    it('works with wildcards and dots', async () => {
      const rt = createRuntime()

      await rt.run('set list {test.js test.txt other.js}')
      const result3 = await rt.run('lsearch -glob -all $list *.js')
      expect(result3).toBe('0 2')
    })
  })

  describe('dict keys with glob pattern containing dots', () => {
    it('matches literal dots', async () => {
      const rt = createRuntime()

      await rt.run('set d [dict create a.b 1 aXb 2 a.c 3]')
      const result1 = await rt.run('dict keys $d a.b')
      expect(result1).toBe('a.b')

      const result2 = await rt.run('dict keys $d a.*')
      expect(result2).toBe('a.b a.c')

      // Should not match aXb
      await rt.run('set d [dict create aXb 1]')
      const result3 = await rt.run('dict keys $d a.b')
      expect(result3).toBe('')
    })
  })

  describe('dict values with glob pattern containing dots', () => {
    it('matches literal dots', async () => {
      const rt = createRuntime()

      await rt.run('set d [dict create k1 a.b k2 aXb k3 a.c]')
      const result1 = await rt.run('dict values $d a.b')
      expect(result1).toBe('a.b')

      const result2 = await rt.run('dict values $d a.*')
      expect(result2).toBe('a.b a.c')
    })
  })

  describe('dict filter key with glob pattern containing dots', () => {
    it('matches literal dots', async () => {
      const rt = createRuntime()

      await rt.run('set d [dict create a.b 1 aXb 2 a.c 3 test 4]')
      const result1 = await rt.run('dict filter $d key a.b')
      expect(result1).toBe('a.b 1')

      const result2 = await rt.run('dict filter $d key a.*')
      expect(result2).toBe('a.b 1 a.c 3')
    })
  })

  describe('dict filter value with glob pattern containing dots', () => {
    it('matches literal dots', async () => {
      const rt = createRuntime()

      await rt.run('set d [dict create k1 a.b k2 aXb k3 a.c]')
      const result1 = await rt.run('dict filter $d value a.b')
      expect(result1).toBe('k1 a.b')

      const result2 = await rt.run('dict filter $d value a.*')
      expect(result2).toBe('k1 a.b k3 a.c')
    })
  })

  describe('real-world glob scenarios', () => {
    it('matches file extensions', async () => {
      const rt = createRuntime()
      await rt.run('set files {test.js test.ts app.js README.md}')
      const jsFiles = await rt.run('lsearch -glob -all $files *.js')
      expect(jsFiles).toBe('0 2')
    })

    it('matches versioned files', async () => {
      const rt = createRuntime()
      await rt.run('set versions {app-1.0.0 app-1.0.1 app-2.0.0}')
      const v1 = await rt.run('lsearch -glob -all $versions app-1.*')
      expect(v1).toBe('0 1')
    })

    it('matches email-like patterns', async () => {
      const rt = createRuntime()
      await rt.run('set emails {user@domain.com test@example.org admin@site.net}')
      const domainCom = await rt.run('lsearch -glob -all $emails *@*.com')
      expect(domainCom).toBe('0')
    })

    it('matches path-like patterns', async () => {
      const rt = createRuntime()
      await rt.run('set paths {/usr/bin/node /usr/local/bin/npm /opt/app/main.js}')
      const binPaths = await rt.run('lsearch -glob -all $paths */bin/*')
      expect(binPaths).toBe('0 1')
    })
  })

  describe('edge cases', () => {
    it('handles empty pattern', async () => {
      const rt = createRuntime()
      // Empty pattern should only match empty string
      await rt.run('set list {{} a b}')
      const result = await rt.run('lsearch -glob $list {}')
      expect(result).toBe('0')
    })

    it('handles pattern with only metacharacters', async () => {
      const rt = createRuntime()
      // Pattern with only dots
      await rt.run('set list {... .. .}')
      const result1 = await rt.run('lsearch -glob $list ...')
      expect(result1).toBe('0')

      const result2 = await rt.run('lsearch -glob $list ..')
      expect(result2).toBe('1')
    })
  })
})
