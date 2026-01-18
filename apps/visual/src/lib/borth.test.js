import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRuntime, Vocab } from './borth/index.js'

describe('Vocab', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('core vocab exists at vocabs[0]', () => {
    expect(rt.vocabs[0].name).toBe('core')
  })

  it('core contains primitives', () => {
    expect(rt.vocabs[0].words.has('dup')).toBe(true)
    expect(rt.vocabs[0].words.has('+')).toBe(true)
  })

  it('current is null after init', () => {
    expect(rt.current).toBe(null)
  })
})

describe('in:', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('sets current vocabulary', async () => {
    await rt.run('in: my-app ;')
    expect(rt.current.name).toBe('my-app')
  })

  it('errors on core', async () => {
    await expect(rt.run('in: core ;')).rejects.toThrow()
  })

  it('creates new vocab if not exists', async () => {
    await rt.run('in: new-vocab ;')
    expect(rt.current.name).toBe('new-vocab')
  })

  it('reuses existing vocab', async () => {
    await rt.run('in: my-app ;')
    const first = rt.current
    await rt.run('in: other ;')
    await rt.run('in: my-app ;')
    expect(rt.current).toBe(first)
  })
})

describe('using:', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('does not duplicate existing vocab in lookup list', async () => {
    await rt.run('in: my-app ; using: core ;')
    // core + my-app = 2, and using: core doesn't add a duplicate
    expect(rt.vocabs.length).toBe(2)
    expect(rt.vocabs.filter(v => v.name === 'core').length).toBe(1)
  })

  it('errors on unknown vocab without resolver', async () => {
    await rt.run('in: my-app ;')
    await expect(rt.run('using: unknown-vocab ;')).rejects.toThrow('unknown vocabulary')
  })

  it('tracks dependencies', async () => {
    // Create a vocab first
    await rt.run('in: utils ;')
    const utils = rt.current
    // Add to vocabs
    rt.vocabs.push(utils)
    // Now use it from another vocab
    await rt.run('in: my-app ;')
    await rt.run('using: utils ;')
    expect(rt.current.dependencies.has(utils)).toBe(true)
    expect(utils.dependents.has(rt.current)).toBe(true)
  })
})

describe('word definition', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it(': requires current vocab', async () => {
    await expect(rt.run(': foo ;')).rejects.toThrow('requires current vocabulary')
  })

  it('defines word in current vocab', async () => {
    await rt.run('in: test ; : double dup + ;')
    expect(rt.current.words.has('double')).toBe(true)
  })

  it(':_ marks word as private', async () => {
    await rt.run('in: test ; :_ helper 1 ;')
    const word = rt.current.words.get('helper')
    expect(word.attributes.private).toBe(true)
  })

  it('private words not visible from other vocabs', async () => {
    await rt.run('in: utils ; :_ internal 42 ;')
    const utils = rt.current
    rt.vocabs.push(utils)
    await rt.run('in: app ;')
    // internal should not be findable
    expect(utils.lookup('internal', false)).toBe(null)
    expect(utils.lookup('internal', true)).not.toBe(null)
  })
})

describe('reference tracking', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('tracks forward references', async () => {
    await rt.run('in: test ; : foo dup + ; : bar foo foo ;')
    const bar = rt.current.words.get('bar')
    const foo = rt.current.words.get('foo')
    expect(bar.references.has(foo)).toBe(true)
  })

  it('tracks backward references', async () => {
    await rt.run('in: test ; : foo dup + ; : bar foo foo ;')
    const bar = rt.current.words.get('bar')
    const foo = rt.current.words.get('foo')
    expect(foo.referencedBy.has(bar)).toBe(true)
  })

  it('tracks references to primitives', async () => {
    await rt.run('in: test ; : double dup + ;')
    const double = rt.current.words.get('double')
    const dup = rt.vocabs[0].words.get('dup')
    const plus = rt.vocabs[0].words.get('+')
    expect(double.references.has(dup)).toBe(true)
    expect(double.references.has(plus)).toBe(true)
  })
})

describe('lookup order', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('current shadows imported vocabs', async () => {
    await rt.run('in: test ; : dup " shadowed" ;')
    await rt.run('dup')
    expect(rt.target.read()).toBe('shadowed')
  })

  it('later vocabs shadow earlier ones', async () => {
    await rt.run('in: v1 ; : greet " hello" ;')
    const v1 = rt.current
    rt.vocabs.push(v1)
    await rt.run('in: v2 ; : greet " hi" ;')
    const v2 = rt.current
    rt.vocabs.push(v2)
    // v2 should shadow v1
    await rt.run('greet')
    expect(rt.target.read()).toBe('hi')
  })
})

describe('booleans', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('comparisons return booleans', async () => {
    await rt.run('in: test ; 5 3 >')
    expect(rt.target.read()).toBe(true)
    await rt.run('3 5 >')
    expect(rt.target.read()).toBe(false)
  })

  it('true/false words work', async () => {
    await rt.run('in: test ; true false')
    expect(rt.target.read()).toBe(false)
    expect(rt.target.read()).toBe(true)
  })

  it('and/or work correctly', async () => {
    await rt.run('in: test ; true true and')
    expect(rt.target.read()).toBe(true)
    await rt.run('true false and')
    expect(rt.target.read()).toBe(false)
    await rt.run('true false or')
    expect(rt.target.read()).toBe(true)
    await rt.run('false false or')
    expect(rt.target.read()).toBe(false)
  })

  it('not works correctly', async () => {
    await rt.run('in: test ; true not')
    expect(rt.target.read()).toBe(false)
    await rt.run('false not')
    expect(rt.target.read()).toBe(true)
  })

  it('0= returns boolean', async () => {
    await rt.run('in: test ; 0 0=')
    expect(rt.target.read()).toBe(true)
    await rt.run('5 0=')
    expect(rt.target.read()).toBe(false)
  })
})

describe('allWords() method', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('allWords() returns all words', () => {
    const all = rt.allWords()
    expect(all['dup']).toBeDefined()
    expect(all['+']).toBeDefined()
  })

  it('allWords() includes current vocab words', async () => {
    await rt.run('in: test ; : myword 1 ;')
    const all = rt.allWords()
    expect(all['myword']).toBeDefined()
  })
})

describe('word attributes', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('words have vocab reference', async () => {
    await rt.run('in: test ; : foo 1 ;')
    const foo = rt.current.words.get('foo')
    expect(foo.vocab).toBe(rt.current)
  })

  it('primitives have core vocab reference', () => {
    const dup = rt.vocabs[0].words.get('dup')
    expect(dup.vocab).toBe(rt.vocabs[0])
  })
})

describe('mod operator', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('mod returns remainder', async () => {
    await rt.run('in: test ; 10 3 mod')
    expect(rt.target.read()).toBe(1)
  })

  it('mod with negative numbers', async () => {
    await rt.run('in: test ; -10 3 mod')
    expect(rt.target.read()).toBe(-1)
  })
})

describe('validation consistency', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('variable requires current vocab', async () => {
    await expect(rt.run('variable x')).rejects.toThrow('requires current vocabulary')
  })

  it('syn: requires current vocab', async () => {
    await expect(rt.run('syn: foo ;')).rejects.toThrow('requires current vocabulary')
  })

  it('variable works with current vocab', async () => {
    await rt.run('in: test ; variable counter')
    expect(rt.current.words.has('counter')).toBe(true)
  })
})

describe('lazy vocab loading', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('resolver caches vocab instances', async () => {
    const first = await rt.resolver.resolve('io')
    const second = await rt.resolver.resolve('io')
    expect(first).toBe(second)
  })

  it('resolver.register adds new vocab factory', async () => {
    rt.resolver.register('custom', () => {
      return new Vocab('custom')
    })
    const vocab = await rt.resolver.resolve('custom')
    expect(vocab.name).toBe('custom')
  })

  it('io vocab loads via using:', async () => {
    await rt.run('in: test ; using: io ;')
    const ioVocab = rt.vocabs.find(v => v.name === 'io')
    expect(ioVocab).toBeDefined()
    expect(ioVocab.words.has('.log')).toBe(true)
  })

  it('events vocab loads via using:', async () => {
    await rt.run('in: test ; using: events ;')
    const eventsVocab = rt.vocabs.find(v => v.name === 'events')
    expect(eventsVocab).toBeDefined()
    expect(eventsVocab.words.has('emit')).toBe(true)
    expect(eventsVocab.words.has('toast')).toBe(true)
  })

  it('editor vocab loads via using:', async () => {
    await rt.run('in: test ; using: editor ;')
    const editorVocab = rt.vocabs.find(v => v.name === 'editor')
    expect(editorVocab).toBeDefined()
    expect(editorVocab.words.has('cmd')).toBe(true)
    expect(editorVocab.words.has('key:')).toBe(true)
  })

  it('reflect vocab loads via using:', async () => {
    await rt.run('in: test ; using: reflect ;')
    const reflectVocab = rt.vocabs.find(v => v.name === 'reflect')
    expect(reflectVocab).toBeDefined()
    expect(reflectVocab.words.has('words')).toBe(true)
    expect(reflectVocab.words.has('find')).toBe(true)
  })

  it('multiple vocabs can be loaded at once', async () => {
    await rt.run('in: test ; using: io events editor ;')
    expect(rt.vocabs.find(v => v.name === 'io')).toBeDefined()
    expect(rt.vocabs.find(v => v.name === 'events')).toBeDefined()
    expect(rt.vocabs.find(v => v.name === 'editor')).toBeDefined()
  })
})

describe('vocab isolation', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('.log not available without io vocab', async () => {
    await rt.run('in: test ;')
    await expect(rt.run('.log')).rejects.toThrow('unknown word')
  })

  it('emit not available without events vocab', async () => {
    await rt.run('in: test ;')
    await expect(rt.run('emit')).rejects.toThrow('unknown word')
  })

  it('cmd not available without editor vocab', async () => {
    await rt.run('in: test ;')
    await expect(rt.run('cmd')).rejects.toThrow('unknown word')
  })

  it('words not available without reflect vocab', async () => {
    await rt.run('in: test ;')
    await expect(rt.run('words')).rejects.toThrow('unknown word')
  })

  it('.log works after importing io', async () => {
    await rt.run('in: test ; using: io ; " test" .log')
    // No error means it worked
  })
})

describe('core primitives remain available', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('dup is always available', async () => {
    await rt.run('in: test ; 5 dup +')
    expect(rt.target.read()).toBe(10)
  })

  it('arithmetic is always available', async () => {
    await rt.run('in: test ; 10 3 mod')
    expect(rt.target.read()).toBe(1)
  })

  it('now is always available', async () => {
    await rt.run('in: test ; now')
    const result = rt.target.read()
    expect(typeof result).toBe('string')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}/)
  })
})

describe('graph vocabulary', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('creates empty graph', async () => {
    await rt.run('in: test ; using: graph ; <graph>')
    const g = rt.target.read()
    expect(g.nodes).toEqual([])
    expect(g.edges).toEqual([])
  })

  it('gets nodes and edges from graph', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  g <graph> .write')
    await rt.run('g .read .nodes length')
    expect(rt.target.read()).toBe(0)
    await rt.run('g .read .edges length')
    expect(rt.target.read()).toBe(0)
  })

  it('adds nodes with _graph reference', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  g <graph> .write')
    await rt.run('variable a')
    await rt.run(`a g .read [ " Alice" " person" ] [ ' name ' type ] structure .add-node .write`)
    await rt.run('a .read .graph g .read =')
    expect(rt.target.read()).toBe(true)
  })

  it('finds node by id', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  g <graph> .write')
    await rt.run(`g .read [ " Alice" ] [ ' name ] structure .add-node`)
    const node = rt.target.read()
    await rt.run(`g .read " ${node.id}" .get-node ' name .prop`)
    expect(rt.target.read()).toBe("Alice")
  })

  it('removes node and its edges', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  g <graph> .write')
    await rt.run('variable a  variable b')
    await rt.run(`a g .read [ " A" ] [ ' name ] structure .add-node .write`)
    await rt.run(`b g .read [ " B" ] [ ' name ] structure .add-node .write`)
    await rt.run(`a .read b .read " knows" .connect drop`)
    await rt.run('a .read .rm')
    await rt.run('g .read .nodes length')
    expect(rt.target.read()).toBe(1)
    await rt.run('g .read .edges length')
    expect(rt.target.read()).toBe(0)
  })

  it('gets and sets properties with .prop/.prop!', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  g <graph> .write')
    await rt.run('variable a')
    await rt.run(`a g .read [ " Alice" ] [ ' name ] structure .add-node .write`)
    await rt.run(`a .read ' age 30 .prop!`)
    await rt.run(`a .read ' age .prop`)
    expect(rt.target.read()).toBe(30)
  })

  it('connects nodes and gets outgoing', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  g <graph> .write')
    await rt.run('variable a  variable b')
    await rt.run(`a g .read [ " A" ] [ ' name ] structure .add-node .write`)
    await rt.run(`b g .read [ " B" ] [ ' name ] structure .add-node .write`)
    await rt.run(`a .read b .read " knows" .connect drop`)
    await rt.run('a .read .outgoing length')
    expect(rt.target.read()).toBe(1)
  })

  it('gets incoming nodes', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  g <graph> .write')
    await rt.run('variable a  variable b')
    await rt.run(`a g .read [ " A" ] [ ' name ] structure .add-node .write`)
    await rt.run(`b g .read [ " B" ] [ ' name ] structure .add-node .write`)
    await rt.run(`a .read b .read " knows" .connect drop`)
    await rt.run('b .read .incoming length')
    expect(rt.target.read()).toBe(1)
  })

  it('disconnects nodes', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  g <graph> .write')
    await rt.run('variable a  variable b')
    await rt.run(`a g .read [ " A" ] [ ' name ] structure .add-node .write`)
    await rt.run(`b g .read [ " B" ] [ ' name ] structure .add-node .write`)
    await rt.run(`a .read b .read " knows" .connect drop`)
    await rt.run('a .read b .read .disconnect')
    await rt.run('g .read .edges length')
    expect(rt.target.read()).toBe(0)
  })

  it('traverses reachable nodes', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  g <graph> .write')
    await rt.run('variable a  variable b  variable c  variable d')
    await rt.run(`a g .read [ " A" ] [ ' name ] structure .add-node .write`)
    await rt.run(`b g .read [ " B" ] [ ' name ] structure .add-node .write`)
    await rt.run(`c g .read [ " C" ] [ ' name ] structure .add-node .write`)
    await rt.run(`d g .read [ " D" ] [ ' name ] structure .add-node .write`)
    await rt.run(`a .read b .read " x" .connect drop`)
    await rt.run(`b .read c .read " x" .connect drop`)
    // d is disconnected - should not be visited
    await rt.run('variable count  count 0 .write')
    await rt.run('a .read [ drop count .read 1 + count swap .write ] .traverse')
    await rt.run('count .read')
    expect(rt.target.read()).toBe(3)
  })

  it('handles cycles in traversal', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  g <graph> .write')
    await rt.run('variable a  variable b')
    await rt.run(`a g .read [ " A" ] [ ' name ] structure .add-node .write`)
    await rt.run(`b g .read [ " B" ] [ ' name ] structure .add-node .write`)
    await rt.run(`a .read b .read " x" .connect drop`)
    await rt.run(`b .read a .read " x" .connect drop`)  // cycle!
    // Should not infinite loop - seen set prevents revisiting
    await rt.run('variable count  count 0 .write')
    await rt.run('a .read [ drop count .read 1 + count swap .write ] .traverse')
    await rt.run('count .read')
    expect(rt.target.read()).toBe(2)
  })

  it('graph vocab loads via using:', async () => {
    await rt.run('in: test ; using: graph ;')
    const graphVocab = rt.vocabs.find(v => v.name === 'graph')
    expect(graphVocab).toBeDefined()
    expect(graphVocab.words.has('<graph>')).toBe(true)
    expect(graphVocab.words.has('.nodes')).toBe(true)
    expect(graphVocab.words.has('.connect')).toBe(true)
  })
})

describe('word recompilation', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('redefining word updates dependents', async () => {
    await rt.run('in: test ; : foo 1 ; : bar foo ;')
    await rt.run('bar')
    expect(rt.target.read()).toBe(1)

    await rt.run(': foo 2 ;')
    await rt.run('bar')
    expect(rt.target.read()).toBe(2)
  })

  it('redefining word updates transitive dependents', async () => {
    await rt.run('in: test ; : a 1 ; : b a ; : c b ;')
    await rt.run('c')
    expect(rt.target.read()).toBe(1)

    await rt.run(': a 99 ;')
    await rt.run('c')
    expect(rt.target.read()).toBe(99)
  })

  it('references are updated after recompile', async () => {
    await rt.run('in: test ; : foo 1 ; : bar foo ;')
    const bar = rt.current.words.get('bar')
    const oldFoo = rt.current.words.get('foo')
    expect(bar.references.has(oldFoo)).toBe(true)

    await rt.run(': foo 2 ;')
    const newFoo = rt.current.words.get('foo')
    expect(bar.references.has(oldFoo)).toBe(false)
    expect(bar.references.has(newFoo)).toBe(true)
  })

  it('recompiles nested quotations', async () => {
    await rt.run('in: test ; : x 10 ; : y [ x ] ;')
    await rt.run('y do')
    expect(rt.target.read()).toBe(10)

    await rt.run(': x 20 ;')
    await rt.run('y do')
    expect(rt.target.read()).toBe(20)
  })

  it('recompiles all dependents', async () => {
    await rt.run('in: test ; : base 5 ; : a base ; : b base ; : c base ;')
    await rt.run(': base 100 ;')
    await rt.run('a b c + +')
    expect(rt.target.read()).toBe(300)
  })

  it('old word has empty referencedBy after recompile', async () => {
    await rt.run('in: test ; : foo 1 ; : bar foo ;')
    const oldFoo = rt.current.words.get('foo')
    expect(oldFoo.referencedBy.size).toBe(1)

    await rt.run(': foo 2 ;')
    expect(oldFoo.referencedBy.size).toBe(0)
  })

  it('recompiles words across vocabs', async () => {
    await rt.run('in: lib ; : helper 1 ;')
    rt.vocabs.push(rt.current)
    await rt.run('in: app ; using: lib ; : use-helper helper ;')
    await rt.run('use-helper')
    expect(rt.target.read()).toBe(1)

    await rt.run('in: lib ; : helper 2 ;')
    await rt.run('in: app ; use-helper')
    expect(rt.target.read()).toBe(2)
  })
})

describe('hooks vocabulary', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('defines a hook', async () => {
    await rt.run('in: test ; using: hooks ;')
    await rt.run('hook on-click')
    await rt.run('on-click')
    const hook = rt.target.read()
    expect(hook._type).toBe('hook')
  })

  it('registers and triggers handlers', async () => {
    await rt.run('in: test ; using: hooks ;')
    await rt.run('hook on-click')
    await rt.run('variable called  called 0 .write')
    await rt.run("on-click ' h1 [ called .read 1 + called swap .write ] .when")
    await rt.run('on-click .trigger')
    await rt.run('called .read')
    expect(rt.target.read()).toBe(1)
  })

  it('disables handlers', async () => {
    await rt.run('in: test ; using: hooks ;')
    await rt.run('hook on-click')
    await rt.run('variable called  called 0 .write')
    await rt.run("on-click ' h1 [ called .read 1 + called swap .write ] .when")
    await rt.run("on-click ' h1 .disable")
    await rt.run('on-click .trigger')
    await rt.run('called .read')
    expect(rt.target.read()).toBe(0)
  })

  it('enables handlers', async () => {
    await rt.run('in: test ; using: hooks ;')
    await rt.run('hook on-click')
    await rt.run('variable called  called 0 .write')
    await rt.run("on-click ' h1 [ called .read 1 + called swap .write ] .when")
    await rt.run("on-click ' h1 .disable")
    await rt.run("on-click ' h1 .enable")
    await rt.run('on-click .trigger')
    await rt.run('called .read')
    expect(rt.target.read()).toBe(1)
  })

  it('removes handlers', async () => {
    await rt.run('in: test ; using: hooks ;')
    await rt.run('hook on-click')
    await rt.run("on-click ' h1 [ ] .when")
    await rt.run("on-click ' h1 .remove")
    await rt.run('on-click .handlers length')
    expect(rt.target.read()).toBe(0)
  })

  it('fires once handlers only once', async () => {
    await rt.run('in: test ; using: hooks ;')
    await rt.run('hook on-click')
    await rt.run('variable called  called 0 .write')
    await rt.run('on-click [ called .read 1 + called swap .write ] .once')
    await rt.run('on-click .trigger')
    await rt.run('on-click .trigger')
    await rt.run('called .read')
    expect(rt.target.read()).toBe(1)
  })

  it('lists handler keys', async () => {
    await rt.run('in: test ; using: hooks ;')
    await rt.run('hook on-click')
    await rt.run("on-click ' a [ ] .when")
    await rt.run("on-click ' b [ ] .when")
    await rt.run('on-click .handlers length')
    expect(rt.target.read()).toBe(2)
  })

  it('clears all handlers', async () => {
    await rt.run('in: test ; using: hooks ;')
    await rt.run('hook on-click')
    await rt.run("on-click ' a [ ] .when")
    await rt.run('on-click [ ] .once')
    await rt.run('on-click .clear')
    await rt.run('on-click .handlers length')
    expect(rt.target.read()).toBe(0)
  })

  it('hooks vocab loads via using:', async () => {
    await rt.run('in: test ; using: hooks ;')
    const hooksVocab = rt.vocabs.find(v => v.name === 'hooks')
    expect(hooksVocab).toBeDefined()
    expect(hooksVocab.words.has('hook')).toBe(true)
    expect(hooksVocab.words.has('.trigger')).toBe(true)
    expect(hooksVocab.words.has('.when')).toBe(true)
  })

  it('multiple handlers run in order', async () => {
    await rt.run('in: test ; using: hooks ;')
    await rt.run('hook on-event')
    await rt.run('variable result  result "" .write')
    await rt.run("on-event ' first [ result .read \" a\" + result swap .write ] .when")
    await rt.run("on-event ' second [ result .read \" b\" + result swap .write ] .when")
    await rt.run('on-event .trigger')
    await rt.run('result .read')
    const result = rt.target.read()
    expect(result).toContain('a')
    expect(result).toContain('b')
  })
})

describe('card provenance', () => {
  let rt
  beforeEach(() => {
    rt = createRuntime()
  })

  it('words defined with context have provenance', async () => {
    await rt.run('in: test ; : foo 1 ;', { cardId: 'card-1', version: 0 })
    const foo = rt.current.words.get('foo')
    expect(foo.attributes.provenance).toEqual({
      cardId: 'card-1',
      version: 0,
      definedAt: expect.any(Number)
    })
  })

  it('words defined without context have no provenance', async () => {
    await rt.run('in: test ; : bar 2 ;')
    const bar = rt.current.words.get('bar')
    expect(bar.attributes.provenance).toBeUndefined()
  })

  it('primitives have no provenance', () => {
    const dup = rt.vocabs[0].words.get('dup')
    expect(dup.attributes.provenance).toBeUndefined()
  })

  it('recompilation preserves provenance', async () => {
    await rt.run('in: test ; : base 1 ;', { cardId: 'card-1', version: 0 })
    await rt.run(': user base ;', { cardId: 'card-2', version: 0 })
    const user = rt.current.words.get('user')
    expect(user.attributes.provenance.cardId).toBe('card-2')

    // Redefine base - triggers recompilation of user
    await rt.run(': base 2 ;', { cardId: 'card-1', version: 1 })

    // user's provenance unchanged (it wasn't redefined, just recompiled)
    expect(user.attributes.provenance.cardId).toBe('card-2')
    expect(user.attributes.provenance.version).toBe(0)
  })

  it('redefinition updates provenance', async () => {
    await rt.run('in: test ; : foo 1 ;', { cardId: 'card-1', version: 0 })
    await rt.run(': foo 2 ;', { cardId: 'card-1', version: 1 })
    const foo = rt.current.words.get('foo')
    expect(foo.attributes.provenance.version).toBe(1)
  })

  it('nested context is restored', async () => {
    await rt.run('in: test ; : outer 1 ;', { cardId: 'card-outer', version: 0 })
    await rt.run(': inner 2 ;', { cardId: 'card-inner', version: 0 })

    const outer = rt.current.words.get('outer')
    const inner = rt.current.words.get('inner')
    expect(outer.attributes.provenance.cardId).toBe('card-outer')
    expect(inner.attributes.provenance.cardId).toBe('card-inner')
  })

  it('variables get provenance', async () => {
    await rt.run('in: test ; variable counter', { cardId: 'card-1', version: 0 })
    const counter = rt.current.words.get('counter')
    expect(counter.attributes.provenance.cardId).toBe('card-1')
  })

  it('private words get provenance', async () => {
    await rt.run('in: test ; :_ helper 1 ;', { cardId: 'card-1', version: 0 })
    const helper = rt.current.words.get('helper')
    expect(helper.attributes.provenance.cardId).toBe('card-1')
    expect(helper.attributes.private).toBe(true)
  })
})

// Card storage tests
import { createCardStorage } from './borth/cards.js'
import Database from 'better-sqlite3'

function createTestDb() {
  const db = new Database(':memory:')
  return {
    query(sql, params = []) {
      const stmt = db.prepare(sql)
      const rows = params.length > 0 ? stmt.all(...params) : stmt.all()
      return { rows, rowCount: rows.length }
    },
    execute(sql, params = []) {
      const stmt = db.prepare(sql)
      const info = params.length > 0 ? stmt.run(...params) : stmt.run()
      return { changes: info.changes, lastInsertRowid: info.lastInsertRowid }
    },
    close() {
      db.close()
    }
  }
}

describe('card storage', () => {
  let db
  let cards

  beforeEach(() => {
    db = createTestDb()
    cards = createCardStorage(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('sets', () => {
    it('creates a set', () => {
      const setId = cards.createSet('my-set')
      expect(setId).toBeDefined()
      expect(typeof setId).toBe('string')
    })

    it('gets a set by id', () => {
      const setId = cards.createSet('my-set')
      const set = cards.getSet(setId)
      expect(set.id).toBe(setId)
      expect(set.name).toBe('my-set')
      expect(set.created_at).toBeDefined()
    })

    it('lists all sets', () => {
      cards.createSet('set-1')
      cards.createSet('set-2')
      const sets = cards.listSets()
      expect(sets.length).toBe(2)
    })

    it('deletes a set (orphans cards)', () => {
      const setId = cards.createSet('my-set')
      const cardId = cards.createCard(setId, 'test source')

      cards.deleteSet(setId)

      expect(cards.getSet(setId)).toBe(null)
      // Card should still exist but be orphaned
      const card = cards.getCard(cardId)
      expect(card).not.toBe(null)
      expect(card.set_id).toBe(null)
    })
  })

  describe('card creation', () => {
    it('creates a card with initial source', () => {
      const setId = cards.createSet('my-set')
      const cardId = cards.createCard(setId, ': hello "world" ;')

      expect(cardId).toBeDefined()
      expect(typeof cardId).toBe('string')
    })

    it('creates orphan card (null set)', () => {
      const cardId = cards.createCard(null, 'orphan source')
      const card = cards.getCard(cardId)
      expect(card.set_id).toBe(null)
    })

    it('initial version is 0', () => {
      const cardId = cards.createCard(null, 'source')
      const card = cards.getCard(cardId)
      expect(card.head_version).toBe(0)
    })

    it('gets current source', () => {
      const cardId = cards.createCard(null, 'initial source')
      const source = cards.getCardSource(cardId)
      expect(source).toBe('initial source')
    })
  })

  describe('versioning', () => {
    it('edit creates new version', () => {
      const cardId = cards.createCard(null, 'v0')
      const newVersion = cards.editCard(cardId, 'v1')

      expect(newVersion).toBe(1)
      expect(cards.getCardSource(cardId)).toBe('v1')
    })

    it('multiple edits increment version', () => {
      const cardId = cards.createCard(null, 'v0')
      cards.editCard(cardId, 'v1')
      cards.editCard(cardId, 'v2')
      const v3 = cards.editCard(cardId, 'v3')

      expect(v3).toBe(3)
      expect(cards.getCardSource(cardId)).toBe('v3')
    })

    it('preserves all versions in history', () => {
      const cardId = cards.createCard(null, 'v0')
      cards.editCard(cardId, 'v1')
      cards.editCard(cardId, 'v2')

      const history = cards.getCardHistory(cardId)

      expect(history.length).toBe(3)
      expect(history[0].version).toBe(2) // newest first
      expect(history[0].source).toBe('v2')
      expect(history[1].version).toBe(1)
      expect(history[1].source).toBe('v1')
      expect(history[2].version).toBe(0)
      expect(history[2].source).toBe('v0')
    })

    it('gets specific version', () => {
      const cardId = cards.createCard(null, 'original')
      cards.editCard(cardId, 'modified')

      const v0 = cards.getCardVersion(cardId, 0)
      const v1 = cards.getCardVersion(cardId, 1)

      expect(v0.source).toBe('original')
      expect(v1.source).toBe('modified')
    })

    it('returns null for non-existent version', () => {
      const cardId = cards.createCard(null, 'source')
      const result = cards.getCardVersion(cardId, 999)
      expect(result).toBe(null)
    })

    it('edit throws for non-existent card', () => {
      expect(() => cards.editCard('non-existent', 'source')).toThrow('Card not found')
    })
  })

  describe('rollback', () => {
    it('rollback creates new version with old source', () => {
      const cardId = cards.createCard(null, 'original')
      cards.editCard(cardId, 'modified')
      cards.editCard(cardId, 'latest')

      const newVersion = cards.rollbackCard(cardId, 0)

      expect(newVersion).toBe(3)
      expect(cards.getCardSource(cardId)).toBe('original')
    })

    it('rollback preserves full history', () => {
      const cardId = cards.createCard(null, 'v0')
      cards.editCard(cardId, 'v1')
      cards.rollbackCard(cardId, 0)

      const history = cards.getCardHistory(cardId)

      expect(history.length).toBe(3) // v0, v1, rollback-to-v0
      expect(history[0].source).toBe('v0') // newest is rollback
      expect(history[1].source).toBe('v1')
      expect(history[2].source).toBe('v0')
    })

    it('rollback is reversible', () => {
      const cardId = cards.createCard(null, 'original')
      cards.editCard(cardId, 'changed')
      cards.rollbackCard(cardId, 0) // back to original
      cards.rollbackCard(cardId, 1) // back to changed

      expect(cards.getCardSource(cardId)).toBe('changed')
    })

    it('rollback throws for non-existent version', () => {
      const cardId = cards.createCard(null, 'source')
      expect(() => cards.rollbackCard(cardId, 999)).toThrow('Version not found')
    })
  })

  describe('card management', () => {
    it('moves card to different set', () => {
      const set1 = cards.createSet('set-1')
      const set2 = cards.createSet('set-2')
      const cardId = cards.createCard(set1, 'source')

      cards.moveCard(cardId, set2)

      const card = cards.getCard(cardId)
      expect(card.set_id).toBe(set2)
    })

    it('moves card to orphan (null set)', () => {
      const setId = cards.createSet('my-set')
      const cardId = cards.createCard(setId, 'source')

      cards.moveCard(cardId, null)

      const card = cards.getCard(cardId)
      expect(card.set_id).toBe(null)
    })

    it('deletes card and all versions', () => {
      const cardId = cards.createCard(null, 'v0')
      cards.editCard(cardId, 'v1')
      cards.editCard(cardId, 'v2')

      cards.deleteCard(cardId)

      expect(cards.getCard(cardId)).toBe(null)
      expect(cards.getCardSource(cardId)).toBe(null)
      expect(cards.getCardHistory(cardId)).toEqual([])
    })

    it('lists all cards with current source', () => {
      const setId = cards.createSet('my-set')
      cards.createCard(setId, 'source-1')
      cards.createCard(setId, 'source-2')
      cards.createCard(null, 'orphan')

      const allCards = cards.listCards()

      expect(allCards.length).toBe(3)
      expect(allCards.map(c => c.source).sort()).toEqual(['orphan', 'source-1', 'source-2'])
    })

    it('getSetCards returns cards in a set', () => {
      const set1 = cards.createSet('set-1')
      const set2 = cards.createSet('set-2')
      cards.createCard(set1, 'in-set-1')
      cards.createCard(set2, 'in-set-2')
      cards.createCard(set1, 'also-in-set-1')

      const set1Cards = cards.getSetCards(set1)

      expect(set1Cards.length).toBe(2)
      expect(set1Cards.map(c => c.source).sort()).toEqual(['also-in-set-1', 'in-set-1'])
    })
  })
})
