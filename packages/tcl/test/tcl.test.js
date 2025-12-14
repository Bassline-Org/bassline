import { describe, it, expect } from 'vitest'
import { createInterpreter, parseScript } from '../src/tcl.js'
import { loadStandardCommands } from '../src/commands.js'

describe('parseScript', () => {
  it('parses simple command', async () => {
    const result = parseScript('puts hello')
    expect(result).toEqual([['puts', 'hello']])
  })

  it('parses multiple words', async () => {
    const result = parseScript('set x 10')
    expect(result).toEqual([['set', 'x', '10']])
  })

  it('parses multiple commands on separate lines', async () => {
    const result = parseScript('set x 10\nset y 20')
    expect(result).toEqual([
      ['set', 'x', '10'],
      ['set', 'y', '20'],
    ])
  })

  it('parses commands separated by semicolon', async () => {
    const result = parseScript('set x 10; set y 20')
    expect(result).toEqual([
      ['set', 'x', '10'],
      ['set', 'y', '20'],
    ])
  })

  it('parses braced literals', async () => {
    const result = parseScript('set x {hello world}')
    expect(result).toEqual([['set', 'x', '{hello world}']])
  })

  it('parses nested braces', async () => {
    const result = parseScript('set x {a {b c} d}')
    expect(result).toEqual([['set', 'x', '{a {b c} d}']])
  })

  it('parses bracket substitution', async () => {
    const result = parseScript('puts [set x]')
    expect(result).toEqual([['puts', '[set x]']])
  })

  it('parses nested brackets', async () => {
    const result = parseScript('puts [expr [set x]]')
    expect(result).toEqual([['puts', '[expr [set x]]']])
  })

  it('parses double quoted strings', async () => {
    const result = parseScript('puts "hello world"')
    expect(result).toEqual([['puts', 'hello world']])
  })

  it('ignores comments at line start', async () => {
    const result = parseScript('set x 10\n# this is a comment\nset y 20')
    expect(result).toEqual([
      ['set', 'x', '10'],
      ['set', 'y', '20'],
    ])
  })

  it('ignores comments after semicolon', async () => {
    const result = parseScript('set x 10; # this is a comment\nset y 20')
    expect(result).toEqual([
      ['set', 'x', '10'],
      ['set', 'y', '20'],
    ])
  })

  it('handles line continuation with backslash', async () => {
    const result = parseScript('set x \\\n10')
    expect(result).toEqual([['set', 'x', '10']])
  })

  it('handles empty script', async () => {
    const result = parseScript('')
    expect(result).toEqual([])
  })

  it('handles whitespace only', async () => {
    const result = parseScript('   \n\n   ')
    expect(result).toEqual([])
  })

})

describe('createInterpreter', () => {
  it('creates interpreter with empty commands', async () => {
    const interp = createInterpreter()
    expect(await interp.run).toBeDefined()
    expect(interp.register).toBeDefined()
    expect(interp.commands).toBeDefined()
  })

  it('registers and calls a command', async () => {
    const interp = createInterpreter()
    interp.register('echo', (args) => args.join(' '))

    const result = await interp.run('echo hello world')
    expect(result).toBe('hello world')
  })

  it('throws on unknown command', async () => {
    const interp = createInterpreter()
    await expect(interp.run('unknown')).rejects.toThrow(/Unknown command: unknown/)
  })

  it('passes interpreter to command', async () => {
    const interp = createInterpreter()
    let receivedInterp = null
    interp.register('capture', (args, i) => {
      receivedInterp = i
      return ''
    })

    await interp.run('capture')
    expect(receivedInterp).toBe(interp)
  })
})

describe('substitution', () => {
  it('substitutes command in brackets', async () => {
    const interp = createInterpreter()
    interp.register('inner', () => 'result')
    interp.register('outer', (args) => `got: ${args[0]}`)

    const result = await interp.run('outer [inner]')
    expect(result).toBe('got: result')
  })

  it('substitutes nested brackets', async () => {
    const interp = createInterpreter()
    interp.register('a', () => '1')
    interp.register('b', (args) => `2${args[0]}`)
    interp.register('c', (args) => `3${args[0]}`)

    const result = await interp.run('c [b [a]]')
    expect(result).toBe('321')
  })

  it('does not substitute inside braces', async () => {
    const interp = createInterpreter()
    interp.register('echo', (args) => args[0])

    const result = await interp.run('echo {[not evaluated]}')
    expect(result).toBe('[not evaluated]')
  })

  it('substitutes variables with vlookup', async () => {
    const interp = createInterpreter()
    interp.register('vlookup', (args) => {
      if (args[0] === 'x') return 'value_of_x'
      throw new Error(`Unknown: ${args[0]}`)
    })
    interp.register('echo', (args) => args[0])

    const result = await interp.run('echo $x')
    expect(result).toBe('value_of_x')
  })

  it('throws when vlookup not available for variable', async () => {
    const interp = createInterpreter()
    interp.register('echo', (args) => args[0])

    await expect(interp.run('echo $x')).rejects.toThrow(/vlookup command/)
  })

  it('substitutes multiple variables in one word', async () => {
    const interp = createInterpreter()
    const vars = { a: 'hello', b: 'world' }
    interp.register('vlookup', (args) => vars[args[0]] || '')
    interp.register('echo', (args) => args[0])

    const result = await interp.run('echo "$a $b"')
    expect(result).toBe('hello world')
  })

  it('does not re-scan variable substitution results', async () => {
    // Per Tcl rule 11: results of substitution are not scanned again
    const interp = createInterpreter()
    let wasCalled = false
    interp.register('vlookup', (args) => {
      if (args[0] === 'x') return '[shouldnt run]'
      throw new Error(`Unknown: ${args[0]}`)
    })
    interp.register('shouldnt', () => {
      wasCalled = true
      return 'BAD'
    })
    interp.register('echo', (args) => args[0])

    const result = await interp.run('echo $x')
    expect(result).toBe('[shouldnt run]')
    expect(wasCalled).toBe(false)
  })

  it('does not re-scan command substitution results', async () => {
    const interp = createInterpreter()
    let secondCallCount = 0
    interp.register('first', () => '[second]')
    interp.register('second', () => {
      secondCallCount++
      return 'BAD'
    })
    interp.register('echo', (args) => args[0])

    const result = await interp.run('echo [first]')
    expect(result).toBe('[second]')
    expect(secondCallCount).toBe(0)
  })

  it('handles backslash escape sequences', async () => {
    const interp = createInterpreter()
    interp.register('echo', (args) => args[0])

    expect(await interp.run('echo "hello\\nworld"')).toBe('hello\nworld')
    expect(await interp.run('echo "tab\\there"')).toBe('tab\there')
    expect(await interp.run('echo "back\\\\slash"')).toBe('back\\slash')
  })

  it('handles hex escapes', async () => {
    const interp = createInterpreter()
    interp.register('echo', (args) => args[0])

    expect(await interp.run('echo "\\x41\\x42\\x43"')).toBe('ABC')
  })

  it('handles unicode escapes', async () => {
    const interp = createInterpreter()
    interp.register('echo', (args) => args[0])

    expect(await interp.run('echo "\\u0048\\u0069"')).toBe('Hi')
  })

  it('passes through unknown escapes literally', async () => {
    const interp = createInterpreter()
    interp.register('echo', (args) => args[0])

    expect(await interp.run('echo "\\q"')).toBe('q')
  })

  it('handles backslash-newline inside braces (rule 6)', async () => {
    const interp = createInterpreter()
    interp.register('echo', (args) => args[0])

    // Backslash-newline inside braces should be removed
    const script = 'echo {hello' + String.fromCharCode(92, 10) + 'world}'
    expect(await interp.run(script)).toBe('helloworld')

    // Trailing whitespace after newline should also be removed
    const script2 = 'echo {hello' + String.fromCharCode(92, 10) + '    world}'
    expect(await interp.run(script2)).toBe('helloworld')
  })
})

describe('{*} argument expansion', () => {
  it('expands braced list into multiple arguments', async () => {
    const interp = createInterpreter()
    interp.register('list', (args) => args.join(' '))

    // {*}{a b c} should expand to three separate args
    const result = await interp.run('list {*}{a b c}')
    expect(result).toBe('a b c')
  })

  it('expands variable containing list', async () => {
    const interp = createInterpreter()
    const vars = { mylist: 'a b c' }
    interp.register('vlookup', (args) => vars[args[0]] ?? '')
    interp.register('list', (args) => args.join(' '))

    const result = await interp.run('list {*}$mylist')
    expect(result).toBe('a b c')
  })

  it('preserves braced elements in expanded list', async () => {
    const interp = createInterpreter()
    interp.register('getarg', (args) => args[1]) // get second arg

    // {*}{a {b c} d} should give args: a, {b c}, d
    // But after list parsing, {b c} becomes "b c"
    const result = await interp.run('getarg {*}{a {b c} d}')
    expect(result).toBe('b c')
  })

  it('does not substitute inside expanded list elements', async () => {
    const interp = createInterpreter()
    let wasCalled = false
    interp.register('dangerous', () => {
      wasCalled = true
      return 'BAD'
    })
    interp.register('getarg', (args) => args[0])

    // [dangerous] should NOT be evaluated - it's a literal in the list
    const result = await interp.run('getarg {*}{[dangerous]}')
    expect(result).toBe('[dangerous]')
    expect(wasCalled).toBe(false)
  })

  it('combines with regular arguments', async () => {
    const interp = createInterpreter()
    interp.register('list', (args) => args.join(','))

    const result = await interp.run('list a {*}{b c} d')
    expect(result).toBe('a,b,c,d')
  })
})

describe('standard commands', () => {
  function makeInterp() {
    const interp = createInterpreter()
    loadStandardCommands(interp)
    return interp
  }

  describe('set/vlookup', () => {
    it('sets and retrieves variable', async () => {
      const interp = makeInterp()
      await interp.run('set x 42')
      const result = await interp.run('set x')
      expect(result).toBe('42')
    })

    it('variable substitution works', async () => {
      const interp = makeInterp()
      await interp.run('set x hello')
      interp.register('echo', (args) => args[0])
      const result = await interp.run('echo $x')
      expect(result).toBe('hello')
    })
  })

  describe('list', () => {
    it('creates a Tcl list', async () => {
      const interp = makeInterp()
      const result = await interp.run('list a b c')
      expect(result).toBe('a b c')
    })

    it('lindex gets element', async () => {
      const interp = makeInterp()
      await interp.run('set mylist [list a b c]')
      const result = await interp.run('lindex $mylist 1')
      expect(result).toBe('b')
    })

    it('llength returns length', async () => {
      const interp = makeInterp()
      const result = await interp.run('llength [list a b c d]')
      expect(result).toBe('4')
    })

    it('lrange returns sublist', async () => {
      const interp = makeInterp()
      const result = await interp.run('lrange {a b c d e} 1 3')
      expect(result).toBe('b c d')
    })
  })

  describe('json', () => {
    it('jstr creates a JSON string', async () => {
      const interp = makeInterp()
      expect(await interp.run('jstr hello')).toBe('"hello"')
      expect(await interp.run('jstr "with spaces"')).toBe('"with spaces"')
    })

    it('jnum creates a JSON number', async () => {
      const interp = makeInterp()
      expect(await interp.run('jnum 42')).toBe('42')
      expect(await interp.run('jnum 3.14')).toBe('3.14')
      expect(await interp.run('jnum -10')).toBe('-10')
    })

    it('jbool creates a JSON boolean', async () => {
      const interp = makeInterp()
      expect(await interp.run('jbool true')).toBe('true')
      expect(await interp.run('jbool false')).toBe('false')
      expect(await interp.run('jbool 1')).toBe('true')
      expect(await interp.run('jbool 0')).toBe('false')
    })

    it('jnull creates JSON null', async () => {
      const interp = makeInterp()
      expect(await interp.run('jnull')).toBe('null')
    })

    it('jobj creates a JSON object from typed values', async () => {
      const interp = makeInterp()
      const result = await interp.run('jobj name [jstr alice] age [jnum 30]')
      expect(result).toBe('{"name":"alice","age":30}')
    })

    it('jarr creates a JSON array from typed values', async () => {
      const interp = makeInterp()
      const result = await interp.run('jarr [jstr a] [jstr b] [jstr c]')
      expect(result).toBe('["a","b","c"]')
    })

    it('jget gets a value from JSON object', async () => {
      const interp = makeInterp()
      await interp.run('set d [jobj name [jstr bob]]')
      const result = await interp.run('jget $d name')
      expect(result).toBe('"bob"')
    })

    it('handles nested structures', async () => {
      const interp = makeInterp()
      const result = await interp.run('jobj items [jarr [jnum 1] [jnum 2] [jnum 3]]')
      expect(result).toBe('{"items":[1,2,3]}')
    })

    it('jget returns JSON fragment for nested values', async () => {
      const interp = makeInterp()
      await interp.run('set d [jobj items [jarr [jnum 1] [jnum 2]]]')
      const result = await interp.run('jget $d items')
      expect(result).toBe('[1,2]')
    })
  })

  describe('control flow', () => {
    it('if true branch', async () => {
      const interp = makeInterp()
      const result = await interp.run('if 1 {return yes} else {return no}')
      expect(result).toBe('yes')
    })

    it('if false branch', async () => {
      const interp = makeInterp()
      const result = await interp.run('if 0 {return yes} else {return no}')
      expect(result).toBe('no')
    })

    it('if with expr condition', async () => {
      const interp = makeInterp()
      await interp.run('set x 5')
      const result = await interp.run('if [expr $x > 3] {return big} else {return small}')
      expect(result).toBe('big')
    })

    it('while loop', async () => {
      const interp = makeInterp()
      await interp.run('set x 0')
      await interp.run('set result {}')
      await interp.run('while {expr $x < 3} {lappend result $x; incr x}')
      const result = await interp.run('set result')
      expect(result).toBe('0 1 2')
    })

    it('foreach loop', async () => {
      const interp = makeInterp()
      await interp.run('set sum 0')
      await interp.run('foreach n {1 2 3} {set sum [expr $sum + $n]}')
      const result = await interp.run('set sum')
      expect(result).toBe('6')
    })
  })

  describe('proc', () => {
    it('defines and calls procedure', async () => {
      const interp = makeInterp()
      await interp.run('proc double {x} {expr $x * 2}')
      const result = await interp.run('double 5')
      expect(result).toBe('10')
    })

    it('procedure with multiple args', async () => {
      const interp = makeInterp()
      await interp.run('proc add {a b} {expr $a + $b}')
      const result = await interp.run('add 3 4')
      expect(result).toBe('7')
    })
  })

  describe('string', () => {
    it('string length', async () => {
      const interp = makeInterp()
      const result = await interp.run('string length hello')
      expect(result).toBe('5')
    })

    it('string equal', async () => {
      const interp = makeInterp()
      expect(await interp.run('string equal foo foo')).toBe('1')
      expect(await interp.run('string equal foo bar')).toBe('0')
    })

    it('string range', async () => {
      const interp = makeInterp()
      const result = await interp.run('string range hello 1 3')
      expect(result).toBe('ell')
    })
  })

  describe('expr', () => {
    it('evaluates arithmetic', async () => {
      const interp = makeInterp()
      expect(await interp.run('expr 2 + 3')).toBe('5')
      expect(await interp.run('expr 10 - 4')).toBe('6')
      expect(await interp.run('expr 3 * 4')).toBe('12')
      expect(await interp.run('expr 15 / 3')).toBe('5')
    })

    it('evaluates comparison', async () => {
      const interp = makeInterp()
      expect(await interp.run('expr 5 > 3')).toBe('true')
      expect(await interp.run('expr 2 < 1')).toBe('false')
    })

    it('rejects unsafe expressions', async () => {
      const interp = makeInterp()
      await expect(interp.run('expr console.log')).rejects.toThrow(/invalid expression/)
    })
  })

  describe('incr', () => {
    it('increments by 1', async () => {
      const interp = makeInterp()
      await interp.run('set x 5')
      const result = await interp.run('incr x')
      expect(result).toBe('6')
      expect(await interp.run('set x')).toBe('6')
    })

    it('increments by amount', async () => {
      const interp = makeInterp()
      await interp.run('set x 5')
      const result = await interp.run('incr x 10')
      expect(result).toBe('15')
    })
  })
})

describe('integration', () => {
  it('complex nested evaluation with Tcl lists', async () => {
    const interp = createInterpreter()
    loadStandardCommands(interp)

    await interp.run('set vals {1 2 3 4 5}')
    const result = await interp.run('llength $vals')

    expect(result).toBe('5')
  })

  it('procedure using jobj', async () => {
    const interp = createInterpreter()
    loadStandardCommands(interp)

    await interp.run(`
      proc person {name age} {
        jobj name [jstr $name] age [jnum $age]
      }
    `)

    const result = await interp.run('person Alice 30')
    const parsed = JSON.parse(result)
    expect(parsed.name).toBe('Alice')
    expect(parsed.age).toBe(30)
  })
})

describe('async commands', () => {
  it('supports async commands', async () => {
    const interp = createInterpreter()
    interp.register('delay', async (args) => {
      await new Promise((r) => setTimeout(r, 10))
      return args[0]
    })

    const result = await interp.run('delay hello')
    expect(result).toBe('hello')
  })

  it('async commands work in command substitution', async () => {
    const interp = createInterpreter()
    interp.register('async_upper', async (args) => {
      await new Promise((r) => setTimeout(r, 5))
      return args[0].toUpperCase()
    })
    interp.register('echo', (args) => args[0])

    const result = await interp.run('echo [async_upper hello]')
    expect(result).toBe('HELLO')
  })

  it('multiple async commands run sequentially', async () => {
    const interp = createInterpreter()
    const order = []
    interp.register('track', async (args) => {
      const id = args[0]
      order.push(`start-${id}`)
      await new Promise((r) => setTimeout(r, 5))
      order.push(`end-${id}`)
      return id
    })

    await interp.run('track a; track b; track c')
    expect(order).toEqual(['start-a', 'end-a', 'start-b', 'end-b', 'start-c', 'end-c'])
  })
})
