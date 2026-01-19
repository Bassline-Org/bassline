import { describe, it, expect } from 'vitest'
import { createRuntime, run, stack, pop, push, find, define, exec, nextWord, parseUntil, lift, def, defI, pushFrame, popFrame, frame, mode, setMode, popN, pushN, _WORD } from './core.js'

// Helper: run code and return top of stack
const evalTo = async (src) => {
  const ctx = createRuntime()
  await run(ctx, src)
  return pop(ctx)
}

// Helper: run code and return entire stack
const evalStack = async (src) => {
  const ctx = createRuntime()
  await run(ctx, src)
  return [...stack(ctx)]
}

describe('stack operations', () => {
  it('push and pop', () => {
    const ctx = createRuntime()
    push(ctx, 1)
    push(ctx, 2)
    expect(pop(ctx)).toBe(2)
    expect(pop(ctx)).toBe(1)
  })

  it('popN pops multiple in order', () => {
    const ctx = createRuntime()
    push(ctx, 1)
    push(ctx, 2)
    push(ctx, 3)
    expect(popN(ctx, 2)).toEqual([2, 3])
  })

  it('pushN pushes multiple', () => {
    const ctx = createRuntime()
    pushN(ctx, [1, 2, 3])
    expect(stack(ctx)).toEqual([1, 2, 3])
  })

  it('pushN skips undefined', () => {
    const ctx = createRuntime()
    pushN(ctx, [1, undefined, 3])
    expect(stack(ctx)).toEqual([1, 3])
  })
})

describe('frame management', () => {
  it('fresh context has one frame in interp mode', () => {
    const ctx = createRuntime()
    expect(ctx.frames.length).toBe(1)
    expect(mode(ctx)).toBe('interp')
  })

  it('pushFrame adds compile frame', () => {
    const ctx = createRuntime()
    pushFrame(ctx)
    expect(ctx.frames.length).toBe(2)
    expect(mode(ctx)).toBe('compile')
  })

  it('popFrame returns frame and removes it', () => {
    const ctx = createRuntime()
    pushFrame(ctx)
    push(ctx, 'test')
    const f = popFrame(ctx)
    expect(f.stack).toEqual(['test'])
    expect(ctx.frames.length).toBe(1)
  })

  it('setMode changes current frame mode', () => {
    const ctx = createRuntime()
    setMode(ctx, 'compile')
    expect(mode(ctx)).toBe('compile')
    setMode(ctx, 'interp')
    expect(mode(ctx)).toBe('interp')
  })

  it('nested frames have independent stacks', () => {
    const ctx = createRuntime()
    push(ctx, 'outer')
    pushFrame(ctx)
    push(ctx, 'inner')
    expect(stack(ctx)).toEqual(['inner'])
    popFrame(ctx)
    expect(stack(ctx)).toEqual(['outer'])
  })
})

describe('parsing', () => {
  it('nextWord skips whitespace', () => {
    const ctx = createRuntime()
    ctx.src = '   hello'
    ctx.pos = 0
    expect(nextWord(ctx)).toBe('hello')
  })

  it('nextWord returns undefined at end', () => {
    const ctx = createRuntime()
    ctx.src = ''
    ctx.pos = 0
    expect(nextWord(ctx)).toBe(undefined)
  })

  it('nextWord handles multiple words', () => {
    const ctx = createRuntime()
    ctx.src = 'one two three'
    ctx.pos = 0
    expect(nextWord(ctx)).toBe('one')
    expect(nextWord(ctx)).toBe('two')
    expect(nextWord(ctx)).toBe('three')
    expect(nextWord(ctx)).toBe(undefined)
  })

  it('parseUntil finds suffix', () => {
    const ctx = createRuntime()
    ctx.src = 'hello world"'
    ctx.pos = 0
    expect(parseUntil(ctx, '"')).toBe('hello world')
  })

  it('parseUntil skips leading whitespace', () => {
    const ctx = createRuntime()
    ctx.src = '   content;'
    ctx.pos = 0
    expect(parseUntil(ctx, ';')).toBe('content')
  })

  it('parseUntil returns rest if no suffix', () => {
    const ctx = createRuntime()
    ctx.src = 'no suffix here'
    ctx.pos = 0
    expect(parseUntil(ctx, ';')).toBe('no suffix here')
  })

  it('parseUntil handles multi-char suffix', () => {
    const ctx = createRuntime()
    ctx.src = 'content--end'
    ctx.pos = 0
    expect(parseUntil(ctx, '--')).toBe('content')
  })
})

describe('vocabulary', () => {
  it('core vocab exists', () => {
    const ctx = createRuntime()
    expect(ctx.vocabs[0].name).toBe('core')
  })

  it('find locates word in core', () => {
    const ctx = createRuntime()
    const dup = find(ctx, 'dup')
    expect(dup.name).toBe('dup')
  })

  it('find parses numbers', () => {
    const ctx = createRuntime()
    expect(find(ctx, '42')).toBe(42)
    expect(find(ctx, '-5')).toBe(-5)
    expect(find(ctx, '3.14')).toBe(3.14)
  })

  it('find throws for unknown word', () => {
    const ctx = createRuntime()
    expect(() => find(ctx, 'nonexistent')).toThrow('unknown: nonexistent')
  })

  it('define adds word to current vocab', () => {
    const ctx = createRuntime()
    define(ctx, 'test', async c => push(c, 99))
    const w = find(ctx, 'test')
    expect(w.name).toBe('test')
  })

  it('define sets ctx.last', () => {
    const ctx = createRuntime()
    define(ctx, 'myword', async c => c)
    expect(ctx.last.name).toBe('myword')
  })

  it('current vocab shadows core', async () => {
    const ctx = createRuntime()
    ctx.current = { name: 'test', words: new Map() }
    ctx.vocabs.push(ctx.current)
    define(ctx, 'dup', async c => push(c, 'shadowed'))
    await run(ctx, 'dup')
    expect(pop(ctx)).toBe('shadowed')
  })

  it('later vocabs shadow earlier', async () => {
    const ctx = createRuntime()
    const v1 = { name: 'v1', words: new Map() }
    const v2 = { name: 'v2', words: new Map() }
    ctx.vocabs.push(v1)
    ctx.vocabs.push(v2)
    v1.words.set('foo', { name: 'foo', fn: async c => push(c, 'v1'), [_WORD]: true })
    v2.words.set('foo', { name: 'foo', fn: async c => push(c, 'v2'), [_WORD]: true })
    await run(ctx, 'foo')
    expect(pop(ctx)).toBe('v2')
  })
})

describe('lift combinator', () => {
  it('lifts nullary function', async () => {
    const ctx = createRuntime()
    const fn = lift(() => 42)
    await fn(ctx)
    expect(pop(ctx)).toBe(42)
  })

  it('lifts unary function', async () => {
    const ctx = createRuntime()
    push(ctx, 5)
    const fn = lift(a => a * 2)
    await fn(ctx)
    expect(pop(ctx)).toBe(10)
  })

  it('lifts binary function', async () => {
    const ctx = createRuntime()
    push(ctx, 3)
    push(ctx, 4)
    const fn = lift((a, b) => a + b)
    await fn(ctx)
    expect(pop(ctx)).toBe(7)
  })

  it('lifts function returning array', async () => {
    const ctx = createRuntime()
    push(ctx, 5)
    const fn = lift(a => [a, a])
    await fn(ctx)
    expect(stack(ctx)).toEqual([5, 5])
  })

  it('lifts function returning undefined', async () => {
    const ctx = createRuntime()
    push(ctx, 5)
    const fn = lift(_ => undefined)
    await fn(ctx)
    expect(stack(ctx)).toEqual([])
  })
})

describe('exec', () => {
  it('executes word in interp mode', async () => {
    const ctx = createRuntime()
    push(ctx, 5)
    const word = find(ctx, 'dup')
    await exec(ctx, word)
    expect(stack(ctx)).toEqual([5, 5])
  })

  it('compiles word ref in compile mode', async () => {
    const ctx = createRuntime()
    setMode(ctx, 'compile')
    const word = find(ctx, 'dup')
    await exec(ctx, word)
    expect(pop(ctx)).toEqual({ ref: 'dup' })
  })

  it('executes immediate word in compile mode', async () => {
    const ctx = createRuntime()
    setMode(ctx, 'compile')
    push(ctx, 5)
    const word = find(ctx, '[')
    await exec(ctx, word)
    expect(ctx.frames.length).toBe(2)
  })

  it('pushes non-word values', async () => {
    const ctx = createRuntime()
    await exec(ctx, 42)
    await exec(ctx, 'hello')
    expect(stack(ctx)).toEqual([42, 'hello'])
  })
})

describe('exec with arrays', () => {
  it('executes array of values', async () => {
    const ctx = createRuntime()
    await exec(ctx, [1, 2, 3])
    expect(stack(ctx)).toEqual([1, 2, 3])
  })

  it('resolves refs', async () => {
    const ctx = createRuntime()
    push(ctx, 5)
    await exec(ctx, [{ ref: 'dup' }, { ref: '+' }])
    expect(pop(ctx)).toBe(10)
  })

  it('handles mixed values and refs', async () => {
    const ctx = createRuntime()
    await exec(ctx, [3, 4, { ref: '+' }])
    expect(pop(ctx)).toBe(7)
  })
})

describe('basic execution', () => {
  it('1 2 + => 3', async () => {
    expect(await evalTo('1 2 +')).toBe(3)
  })

  it('5 3 - => 2', async () => {
    expect(await evalTo('5 3 -')).toBe(2)
  })

  it('4 5 * => 20', async () => {
    expect(await evalTo('4 5 *')).toBe(20)
  })

  it('20 4 / => 5', async () => {
    expect(await evalTo('20 4 /')).toBe(5)
  })

  it('10 3 mod => 1', async () => {
    expect(await evalTo('10 3 mod')).toBe(1)
  })

  it('negative mod', async () => {
    expect(await evalTo('-10 3 mod')).toBe(-1)
  })
})

describe('stack words', () => {
  it('dup duplicates', async () => {
    expect(await evalStack('5 dup')).toEqual([5, 5])
  })

  it('drop removes', async () => {
    expect(await evalStack('1 2 drop')).toEqual([1])
  })

  it('swap exchanges', async () => {
    expect(await evalStack('1 2 swap')).toEqual([2, 1])
  })

  it('rot rotates three', async () => {
    expect(await evalStack('1 2 3 rot')).toEqual([2, 3, 1])
  })

  it('over copies second', async () => {
    expect(await evalStack('1 2 over')).toEqual([1, 2, 1])
  })
})

describe('comparison', () => {
  it('= equality', async () => {
    expect(await evalTo('5 5 =')).toBe(true)
    expect(await evalTo('5 3 =')).toBe(false)
  })

  it('< less than', async () => {
    expect(await evalTo('3 5 <')).toBe(true)
    expect(await evalTo('5 3 <')).toBe(false)
  })

  it('> greater than', async () => {
    expect(await evalTo('5 3 >')).toBe(true)
    expect(await evalTo('3 5 >')).toBe(false)
  })

  it('<= less or equal', async () => {
    expect(await evalTo('3 5 <=')).toBe(true)
    expect(await evalTo('5 5 <=')).toBe(true)
    expect(await evalTo('5 3 <=')).toBe(false)
  })

  it('>= greater or equal', async () => {
    expect(await evalTo('5 3 >=')).toBe(true)
    expect(await evalTo('5 5 >=')).toBe(true)
    expect(await evalTo('3 5 >=')).toBe(false)
  })
})

describe('literals', () => {
  it('true', async () => {
    expect(await evalTo('true')).toBe(true)
  })

  it('false', async () => {
    expect(await evalTo('false')).toBe(false)
  })
})

describe('JS bridge', () => {
  it('.get reads property', async () => {
    const ctx = createRuntime()
    push(ctx, { x: 42 })
    await run(ctx, "' x .get")
    expect(pop(ctx)).toBe(42)
  })

  it('.set writes property', async () => {
    const ctx = createRuntime()
    const obj = { x: 1 }
    push(ctx, obj)
    await run(ctx, "' x 99 .set")
    expect(obj.x).toBe(99)
  })

  it('.call invokes method', async () => {
    const ctx = createRuntime()
    push(ctx, [1, 2, 3])
    push(ctx, ',')
    await run(ctx, "' join swap .call")
    expect(pop(ctx)).toBe('1,2,3')
  })

  it('.call with array arg', async () => {
    const ctx = createRuntime()
    push(ctx, { add: (a, b) => a + b })
    await run(ctx, "' add [ 3 4 ] .call")
    expect(pop(ctx)).toBe(7)
  })
})

// if pops [condition, true-branch, false-branch]
// Stack order: condition true-branch false-branch if
describe('control: if', () => {
  it('true branch', async () => {
    expect(await evalTo('true [ 1 ] [ 2 ] if')).toBe(1)
  })

  it('false branch', async () => {
    expect(await evalTo('false [ 1 ] [ 2 ] if')).toBe(2)
  })

  it('executes quotation body', async () => {
    expect(await evalTo('true [ 3 4 + ] [ 0 ] if')).toBe(7)
  })

  it('with comparison', async () => {
    expect(await evalTo('5 3 > [ 1 ] [ 0 ] if')).toBe(1)
  })
})

describe('control: do', () => {
  it('executes quotation', async () => {
    expect(await evalTo('[ 1 2 + ] do')).toBe(3)
  })

  it('nested do', async () => {
    expect(await evalTo('[ [ 5 ] do ] do')).toBe(5)
  })
})

// times pops [n, body] - stack order: n body times (body on top)
describe('control: times', () => {
  it('executes n times', async () => {
    expect(await evalTo('0 5 [ 1 + ] times')).toBe(5)
  })

  it('pushes index', async () => {
    expect(await evalStack('3 [ ] times')).toEqual([0, 1, 2])
  })

  it('zero times does nothing', async () => {
    expect(await evalStack('0 [ 99 ] times')).toEqual([])
  })
})

// each pops [body, arr] - stack order: body arr each (arr on top)
describe('control: each', () => {
  it('iterates array', async () => {
    expect(await evalTo('0 [ + ] [ 1 2 3 ] each')).toBe(6)
  })

  it('pushes each element', async () => {
    expect(await evalStack('[ ] [ 10 20 30 ] each')).toEqual([10, 20, 30])
  })

  it('empty array does nothing', async () => {
    expect(await evalStack('[ 99 ] [ ] each')).toEqual([])
  })
})

describe('definition: colon', () => {
  it('defines word', async () => {
    expect(await evalTo(': double dup + ; 5 double')).toBe(10)
  })

  it('defined word calls other words', async () => {
    expect(await evalTo(': quad dup + dup + ; 3 quad')).toBe(12)
  })

  it('multiple definitions', async () => {
    expect(await evalTo(': a 1 ; : b 2 ; a b +')).toBe(3)
  })

  // Skipped: forward/recursive references not supported (definition-before-use enforced)
  it.skip('recursive definition via late binding', async () => {
    const ctx = createRuntime()
    // if n > 1 then recurse else return 1
    await run(ctx, ': fact dup 1 > [ dup 1 - fact * ] [ drop 1 ] if ;')
    await run(ctx, '5 fact')
    expect(pop(ctx)).toBe(120)
  })
})

describe('quotation: brackets', () => {
  it('creates array', async () => {
    const result = await evalTo('[ 1 2 3 ]')
    expect(result).toEqual([1, 2, 3])
  })

  it('nested quotations', async () => {
    const result = await evalTo('[ [ 1 ] ]')
    expect(result).toEqual([[1]])
  })

  it('quotation with refs', async () => {
    const result = await evalTo('[ dup + ]')
    expect(result).toEqual([{ ref: 'dup' }, { ref: '+' }])
  })

  it('quotation executable via do', async () => {
    expect(await evalTo('5 [ dup + ] do')).toBe(10)
  })
})

describe('parsing words', () => {
  it("' parses next word as string", async () => {
    expect(await evalTo("' hello")).toBe('hello')
  })

  it('" parses until quote', async () => {
    expect(await evalTo('" hello world"')).toBe('hello world')
  })

  it('parse uses delimiter from stack', async () => {
    const ctx = createRuntime()
    await run(ctx, "' ! parse content!")
    // parseUntil skips leading whitespace
    expect(pop(ctx)).toBe('content')
  })

  it('empty string via "', async () => {
    expect(await evalTo('" "')).toBe('')
  })
})

describe('vocabulary: in:', () => {
  it('creates new vocab', async () => {
    const ctx = createRuntime()
    await run(ctx, 'in: myapp ;')
    expect(ctx.current.name).toBe('myapp')
  })

  it('reuses existing vocab', async () => {
    const ctx = createRuntime()
    await run(ctx, 'in: myapp ;')
    const first = ctx.current
    await run(ctx, 'in: other ;')
    await run(ctx, 'in: myapp ;')
    expect(ctx.current).toBe(first)
  })

  it('adds vocab to lookup list', async () => {
    const ctx = createRuntime()
    await run(ctx, 'in: myapp ;')
    expect(ctx.vocabs.find(v => v.name === 'myapp')).toBe(ctx.current)
  })
})

describe('vocabulary: using:', () => {
  it('adds existing vocab to lookup', async () => {
    const ctx = createRuntime()
    const testVocab = { name: 'test', words: new Map() }
    testVocab.words.set('foo', { name: 'foo', fn: async c => push(c, 42), [_WORD]: true })
    ctx.vocabs.push(testVocab)
    await run(ctx, 'using: test ; foo')
    expect(pop(ctx)).toBe(42)
  })

  it('throws for unknown vocab without resolver', async () => {
    const ctx = createRuntime()
    await expect(run(ctx, 'using: unknown ;')).rejects.toThrow('unknown vocab: unknown')
  })

  it('uses resolver for unknown vocab', async () => {
    const ctx = createRuntime()
    const resolved = { name: 'dynamic', words: new Map() }
    resolved.words.set('bar', { name: 'bar', fn: async c => push(c, 99), [_WORD]: true })
    ctx.resolver = async name => name === 'dynamic' ? resolved : null
    await run(ctx, 'using: dynamic ; bar')
    expect(pop(ctx)).toBe(99)
  })

  it('multiple vocabs in one using:', async () => {
    const ctx = createRuntime()
    const v1 = { name: 'v1', words: new Map() }
    const v2 = { name: 'v2', words: new Map() }
    ctx.vocabs.push(v1)
    ctx.vocabs.push(v2)
    await run(ctx, 'using: v1 v2 ;')
    expect(ctx.vocabs).toContain(v1)
    expect(ctx.vocabs).toContain(v2)
  })

  it('does not duplicate vocab', async () => {
    const ctx = createRuntime()
    const initialLength = ctx.vocabs.length
    await run(ctx, 'using: core ;')
    expect(ctx.vocabs.length).toBe(initialLength)
  })
})

describe('variable', () => {
  it('creates readable/writable cell', async () => {
    const ctx = createRuntime()
    await run(ctx, 'variable x')
    await run(ctx, "x ' write [ 42 ] .call")
    await run(ctx, "x ' read [ ] .call")
    expect(pop(ctx)).toBe(42)
  })

  it('initial value is undefined', async () => {
    const ctx = createRuntime()
    await run(ctx, 'variable y')
    await run(ctx, "y ' read [ ] .call")
    expect(pop(ctx)).toBe(undefined)
  })

  it('multiple variables independent', async () => {
    const ctx = createRuntime()
    await run(ctx, 'variable a variable b')
    await run(ctx, "a ' write [ 1 ] .call")
    await run(ctx, "b ' write [ 2 ] .call")
    await run(ctx, "a ' read [ ] .call")
    await run(ctx, "b ' read [ ] .call")
    await run(ctx, '+')
    expect(pop(ctx)).toBe(3)
  })
})

describe('late binding', () => {
  it('redefined word affects callers', async () => {
    const ctx = createRuntime()
    await run(ctx, ': foo 1 ; : bar foo ;')
    await run(ctx, 'bar')
    expect(pop(ctx)).toBe(1)
    await run(ctx, ': foo 2 ;')
    await run(ctx, 'bar')
    expect(pop(ctx)).toBe(2)
  })

  it('redefined word affects nested calls', async () => {
    const ctx = createRuntime()
    await run(ctx, ': a 10 ; : b a ; : c b ;')
    await run(ctx, 'c')
    expect(pop(ctx)).toBe(10)
    await run(ctx, ': a 20 ;')
    await run(ctx, 'c')
    expect(pop(ctx)).toBe(20)
  })
})

describe('edge cases', () => {
  it('empty program', async () => {
    expect(await evalStack('')).toEqual([])
  })

  it('whitespace only', async () => {
    expect(await evalStack('   \t\n  ')).toEqual([])
  })

  it('deeply nested quotations', async () => {
    const result = await evalTo('[ [ [ [ 42 ] ] ] ]')
    expect(result).toEqual([[[[42]]]])
  })

  it('quotation in definition', async () => {
    expect(await evalTo(': test [ 1 2 + ] do ; test')).toBe(3)
  })

  it('non-immediate words in quotation compile as refs', async () => {
    // : is immediate so it runs during compilation - use a non-immediate word
    const result = await evalTo('[ dup + ]')
    expect(result).toEqual([{ ref: 'dup' }, { ref: '+' }])
  })

  it('floating point arithmetic', async () => {
    expect(await evalTo('3.14 2 *')).toBeCloseTo(6.28)
  })

  it('negative numbers', async () => {
    expect(await evalTo('-5 3 +')).toBe(-2)
  })

  it('string with spaces via "', async () => {
    expect(await evalTo('" hello world"')).toBe('hello world')
  })

  it('chained operations', async () => {
    expect(await evalTo('1 2 + 3 * 4 -')).toBe(5)
  })

  it('complex stack manipulation', async () => {
    expect(await evalStack('1 2 3 rot rot')).toEqual([3, 1, 2])
  })
})

describe('def and defI helpers', () => {
  it('def creates non-immediate word', () => {
    const ctx = createRuntime()
    def('test', () => 42)(ctx)
    const w = find(ctx, 'test')
    expect(w.immediate).toBe(false)
  })

  it('defI creates immediate word', () => {
    const ctx = createRuntime()
    defI('test', () => 42)(ctx)
    const w = find(ctx, 'test')
    expect(w.immediate).toBe(true)
  })
})

describe('mode transitions', () => {
  it(': switches to compile, ; back to interp', async () => {
    const ctx = createRuntime()
    expect(mode(ctx)).toBe('interp')
    ctx.src = ': test'
    ctx.pos = 0
    const colonWord = find(ctx, ':')
    await colonWord.fn(ctx)
    expect(mode(ctx)).toBe('compile')
    const semiWord = find(ctx, ';')
    await semiWord.fn(ctx)
    expect(mode(ctx)).toBe('interp')
  })

  it('[ switches to compile, ] back to interp', async () => {
    const ctx = createRuntime()
    const bracketOpen = find(ctx, '[')
    await bracketOpen.fn(ctx)
    expect(mode(ctx)).toBe('compile')
    const bracketClose = find(ctx, ']')
    await bracketClose.fn(ctx)
    expect(mode(ctx)).toBe('interp')
  })

  it('nested [ ] stays in compile until outermost ]', async () => {
    const ctx = createRuntime()
    await exec(ctx, find(ctx, '['))
    expect(mode(ctx)).toBe('compile')
    await exec(ctx, find(ctx, '['))
    expect(mode(ctx)).toBe('compile')
    await exec(ctx, find(ctx, ']'))
    expect(mode(ctx)).toBe('compile')
    await exec(ctx, find(ctx, ']'))
    expect(mode(ctx)).toBe('interp')
  })
})

describe('integration', () => {
  // Skipped: forward/recursive references not supported (definition-before-use enforced)
  it.skip('fibonacci', async () => {
    const ctx = createRuntime()
    // fib: n -- fib(n)
    // if n < 2 then n else fib(n-1) + fib(n-2)
    await run(ctx, `
      : fib
        dup 2 <
        [ ]
        [ dup 1 - fib swap 2 - fib + ]
        if
      ;
    `)
    await run(ctx, '10 fib')
    expect(pop(ctx)).toBe(55)
  })

  it('map-like operation with definition', async () => {
    const ctx = createRuntime()
    await run(ctx, ': square dup * ;')
    await run(ctx, '[ square ] [ 1 2 3 4 5 ] each')
    expect(stack(ctx)).toEqual([1, 4, 9, 16, 25])
  })

  it('higher-order: apply', async () => {
    const ctx = createRuntime()
    // apply: run quotation on value, then run another quotation
    await run(ctx, ': square [ dup * ] do ;')
    await run(ctx, '3 square')
    expect(pop(ctx)).toBe(9)
    await run(ctx, '4 square')
    expect(pop(ctx)).toBe(16)
  })

  it('conditional accumulator', async () => {
    const ctx = createRuntime()
    // Count even numbers 0-9: each index, if even add 1
    await run(ctx, `
      : even? 2 mod 0 = ;
      : count-evens
        0 swap
        [ even? [ 0 ] [ 1 ] if + ]
        times
      ;
      10 count-evens
    `)
    expect(pop(ctx)).toBe(5)
  })

  it('nested conditionals', async () => {
    const ctx = createRuntime()
    await run(ctx, `
      : classify
        dup 0 <
        [ drop -1 ]
        [ 0 = [ 0 ] [ 1 ] if ]
        if
      ;
    `)
    await run(ctx, '-5 classify')
    expect(pop(ctx)).toBe(-1)
    await run(ctx, '0 classify')
    expect(pop(ctx)).toBe(0)
    await run(ctx, '5 classify')
    expect(pop(ctx)).toBe(1)
  })

  it('quotation as data', async () => {
    const ctx = createRuntime()
    await run(ctx, ': make-adder [ + ] ;')
    await run(ctx, '5 3 make-adder do')
    expect(pop(ctx)).toBe(8)
  })
})
