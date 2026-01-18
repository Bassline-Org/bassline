import { describe, it, expect, beforeEach } from 'vitest'
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

  it('buffer requires current vocab', async () => {
    await expect(rt.run('buffer x')).rejects.toThrow('requires current vocabulary')
  })

  it('stack requires current vocab', async () => {
    await expect(rt.run('stack x')).rejects.toThrow('requires current vocabulary')
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
    await rt.run('variable g  <graph> g .put')
    await rt.run('g .get .nodes length')
    expect(rt.target.read()).toBe(0)
    await rt.run('g .get .edges length')
    expect(rt.target.read()).toBe(0)
  })

  it('adds nodes with _graph reference', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  <graph> g .put')
    await rt.run('variable a')
    await rt.run(`[ " Alice" " person" ] [ ' name ' type ] structure g .get .add-node a .put`)
    await rt.run('a .get .graph g .get =')
    expect(rt.target.read()).toBe(true)
  })

  it('finds node by id', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  <graph> g .put')
    await rt.run(`[ " Alice" ] [ ' name ] structure g .get .add-node`)
    const node = rt.target.read()
    await rt.run(`' name " ${node.id}" g .get .get-node .prop`)
    expect(rt.target.read()).toBe("Alice")
  })

  it('removes node and its edges', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  <graph> g .put')
    await rt.run('variable a  variable b')
    await rt.run(`[ " A" ] [ ' name ] structure g .get .add-node a .put`)
    await rt.run(`[ " B" ] [ ' name ] structure g .get .add-node b .put`)
    await rt.run(`" knows" b .get a .get .connect drop`)
    await rt.run('a .get .rm')
    await rt.run('g .get .nodes length')
    expect(rt.target.read()).toBe(1)
    await rt.run('g .get .edges length')
    expect(rt.target.read()).toBe(0)
  })

  it('gets and sets properties with .prop/.prop!', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  <graph> g .put')
    await rt.run('variable a')
    await rt.run(`[ " Alice" ] [ ' name ] structure g .get .add-node a .put`)
    await rt.run(`30 ' age a .get .prop!`)
    await rt.run(`' age a .get .prop`)
    expect(rt.target.read()).toBe(30)
  })

  it('connects nodes and gets outgoing', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  <graph> g .put')
    await rt.run('variable a  variable b')
    await rt.run(`[ " A" ] [ ' name ] structure g .get .add-node a .put`)
    await rt.run(`[ " B" ] [ ' name ] structure g .get .add-node b .put`)
    await rt.run(`" knows" b .get a .get .connect drop`)
    await rt.run('a .get .outgoing length')
    expect(rt.target.read()).toBe(1)
  })

  it('gets incoming nodes', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  <graph> g .put')
    await rt.run('variable a  variable b')
    await rt.run(`[ " A" ] [ ' name ] structure g .get .add-node a .put`)
    await rt.run(`[ " B" ] [ ' name ] structure g .get .add-node b .put`)
    await rt.run(`" knows" b .get a .get .connect drop`)
    await rt.run('b .get .incoming length')
    expect(rt.target.read()).toBe(1)
  })

  it('disconnects nodes', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  <graph> g .put')
    await rt.run('variable a  variable b')
    await rt.run(`[ " A" ] [ ' name ] structure g .get .add-node a .put`)
    await rt.run(`[ " B" ] [ ' name ] structure g .get .add-node b .put`)
    await rt.run(`" knows" b .get a .get .connect drop`)
    await rt.run('b .get a .get .disconnect')
    await rt.run('g .get .edges length')
    expect(rt.target.read()).toBe(0)
  })

  it('traverses reachable nodes', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  <graph> g .put')
    await rt.run('variable a  variable b  variable c  variable d')
    await rt.run(`[ " A" ] [ ' name ] structure g .get .add-node a .put`)
    await rt.run(`[ " B" ] [ ' name ] structure g .get .add-node b .put`)
    await rt.run(`[ " C" ] [ ' name ] structure g .get .add-node c .put`)
    await rt.run(`[ " D" ] [ ' name ] structure g .get .add-node d .put`)
    await rt.run(`" x" b .get a .get .connect drop`)
    await rt.run(`" x" c .get b .get .connect drop`)
    // d is disconnected - should not be visited
    await rt.run('variable count  0 count .put')
    await rt.run('[ drop count .get 1 + count .put ] a .get .traverse')
    await rt.run('count .get')
    expect(rt.target.read()).toBe(3)
  })

  it('handles cycles in traversal', async () => {
    await rt.run('in: test ; using: graph ;')
    await rt.run('variable g  <graph> g .put')
    await rt.run('variable a  variable b')
    await rt.run(`[ " A" ] [ ' name ] structure g .get .add-node a .put`)
    await rt.run(`[ " B" ] [ ' name ] structure g .get .add-node b .put`)
    await rt.run(`" x" b .get a .get .connect drop`)
    await rt.run(`" x" a .get b .get .connect drop`)  // cycle!
    // Should not infinite loop - seen set prevents revisiting
    await rt.run('variable count  0 count .put')
    await rt.run('[ drop count .get 1 + count .put ] a .get .traverse')
    await rt.run('count .get')
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
