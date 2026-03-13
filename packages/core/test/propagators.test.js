import { describe, it, expect } from 'vitest'
import { Platform, kResource } from '../src/kernel/platform.js'
import { reducers, scope, propagators } from '../src/resources/index.js'

const flush = () => new Promise(r => setTimeout(r, 0))

function setup() {
  const p = new Platform()
  reducers(p)
  scope(p)
  propagators(p)
  return p
}

describe('Propagator', () => {
  describe('subclass with all cells bound', () => {
    it('fires body immediately when all cells are bound at creation', async () => {
      const p = setup()
      const { Propagator } = p.classes

      class Adder extends Propagator {
        body({ a, b, result }) {
          result({ put: a({}) + b({}) })
        }
      }
      p.define({ Adder })

      const a = p.create.Slot({ value: 1 })
      const b = p.create.Slot({ value: 2 })
      const result = p.create.Slot({ value: 0 })

      p.create.Adder({ cells: { a, b, result } })
      await flush()

      expect(result({})).toBe(3)
    })
  })

  describe('subclass with unbound cells', () => {
    it('does not fire body when cells are unbound', async () => {
      const p = setup()
      const { Propagator } = p.classes
      let fired = false

      class Watcher extends Propagator {
        body() {
          fired = true
        }
      }
      p.define({ Watcher })

      p.create.Watcher({ cells: { a: null, b: null } })
      await flush()

      expect(fired).toBe(false)
    })
  })

  describe('late binding', () => {
    it('fires body when last cell is bound via put protocol', async () => {
      const p = setup()
      const { Propagator } = p.classes

      class Adder extends Propagator {
        body({ a, b, result }) {
          result({ put: a({}) + b({}) })
        }
      }
      p.define({ Adder })

      const result = p.create.Slot({ value: 0 })
      const adder = p.create.Adder({ cells: { a: null, b: null, result } })

      await flush()
      expect(result({})).toBe(0) // not fired yet

      const a = p.create.Slot({ value: 10 })
      adder({ put: a, at: 'a' })
      await flush()
      expect(result({})).toBe(0) // still missing b

      const b = p.create.Slot({ value: 5 })
      adder({ put: b, at: 'b' })
      await flush()
      expect(result({})).toBe(15) // now all bound → fires
    })
  })

  describe('unbinding', () => {
    it('stops firing when a cell is unbound', async () => {
      const p = setup()
      const { Propagator } = p.classes
      let fireCount = 0

      class Counter extends Propagator {
        body({ source, sink }) {
          fireCount++
          sink({ put: source({}) })
        }
      }
      p.define({ Counter })

      const source = p.create.Slot({ value: 1 })
      const sink = p.create.Slot({ value: 0 })
      const prop = p.create.Counter({ cells: { source, sink } })
      await flush()

      const countAfterInit = fireCount

      prop({ put: null, at: 'source' })
      source({ put: 2 })
      await flush()
      expect(fireCount).toBe(countAfterInit) // no more fires after unbind
    })
  })

  describe('reactivity', () => {
    it('fires body when a bound resource changes', async () => {
      const p = setup()
      const { Propagator } = p.classes

      class Doubler extends Propagator {
        body({ input, output }) {
          output({ put: input({}) * 2 })
        }
      }
      p.define({ Doubler })

      const input = p.create.Slot({ value: 5 })
      const output = p.create.Slot({ value: 0 })

      p.create.Doubler({ cells: { input, output } })
      await flush()
      expect(output({})).toBe(10)

      input({ put: 7 })
      await flush()
      expect(output({})).toBe(14)
    })
  })

  describe('body receives resource functions and this', () => {
    it('body can read and write through resource functions', async () => {
      const p = setup()
      const { Propagator } = p.classes
      let selfRef = null

      class Checker extends Propagator {
        body({ x }) {
          selfRef = this
          x({}) // just read
        }
      }
      p.define({ Checker })

      const x = p.create.Slot({ value: 42 })
      const prop = p.create.Checker({ cells: { x } })
      await flush()

      expect(selfRef).toBe(prop[kResource])
    })
  })

  describe('this.platform accessible', () => {
    it('propagator has access to platform via this.platform', async () => {
      const p = setup()
      const { Propagator } = p.classes
      let seenPlatform = null

      class PlatformChecker extends Propagator {
        body() {
          seenPlatform = this.platform
        }
      }
      p.define({ PlatformChecker })

      const x = p.create.Slot({ value: 1 })
      p.create.PlatformChecker({ cells: { x } })
      await flush()

      expect(seenPlatform).toBe(p)
    })
  })

  describe('fixed keyspace enforcement', () => {
    it('throws on put to unknown key', () => {
      const p = setup()
      const prop = p.create.Propagator({ cells: { a: null }, body() {} })
      const slot = p.create.Slot({ value: 1 })
      expect(() => prop({ put: slot, at: 'unknown' })).toThrow('unknown key')
    })

    it('rejects tree expansion (plain object body)', () => {
      const p = setup()
      const prop = p.create.Propagator({ cells: { a: null }, body() {} })
      expect(() => prop({ put: { nested: p.create.Slot({ value: 1 }) } })).toThrow('at required')
    })

    it('rejects put without at', () => {
      const p = setup()
      const prop = p.create.Propagator({ cells: { a: null }, body() {} })
      expect(() => prop({ put: p.create.Slot({ value: 1 }) })).toThrow('at required')
    })
  })

  describe('scope protocol', () => {
    it('empty get returns hrefs (bound) and keys (all)', async () => {
      const p = setup()
      const a = p.create.Slot({ value: 1 })
      const prop = p.create.Propagator({ cells: { a, b: null, c: null }, body() {} })

      const result = prop({})
      expect(result.keys).toEqual(['a', 'b', 'c'])
      expect(result.hrefs).toEqual(['a'])
    })

    it('get { at } returns bound resource', () => {
      const p = setup()
      const a = p.create.Slot({ value: 1 })
      const prop = p.create.Propagator({ cells: { a }, body() {} })

      expect(prop({ at: 'a' })).toBe(a)
    })

    it('get { at } throws for unknown key', () => {
      const p = setup()
      const prop = p.create.Propagator({ cells: { a: null }, body() {} })
      expect(() => prop({ at: 'nope' })).toThrow('unknown key')
    })

    it('get { has } returns true for bound key', () => {
      const p = setup()
      const a = p.create.Slot({ value: 1 })
      const prop = p.create.Propagator({ cells: { a }, body() {} })
      expect(prop({ has: 'a' })).toBe(true)
    })

    it('get { has } returns false for unbound key', () => {
      const p = setup()
      const prop = p.create.Propagator({ cells: { a: null }, body() {} })
      expect(prop({ has: 'a' })).toBe(false)
    })

    it('get { has } returns false for unknown key', () => {
      const p = setup()
      const prop = p.create.Propagator({ cells: { a: null }, body() {} })
      expect(prop({ has: 'nope' })).toBe(false)
    })
  })

  describe('multiple propagators watching same resource', () => {
    it('both fire when shared input changes', async () => {
      const p = setup()
      const { Propagator } = p.classes

      class Doubler extends Propagator {
        body({ input, output }) {
          output({ put: input({}) * 2 })
        }
      }
      class Tripler extends Propagator {
        body({ input, output }) {
          output({ put: input({}) * 3 })
        }
      }
      p.define({ Doubler, Tripler })

      const input = p.create.Slot({ value: 1 })
      const doubled = p.create.Slot({ value: 0 })
      const tripled = p.create.Slot({ value: 0 })

      p.create.Doubler({ cells: { input, output: doubled } })
      p.create.Tripler({ cells: { input, output: tripled } })
      await flush()

      expect(doubled({})).toBe(2)
      expect(tripled({})).toBe(3)

      input({ put: 5 })
      await flush()
      expect(doubled({})).toBe(10)
      expect(tripled({})).toBe(15)
    })
  })

  describe('propagator chain', () => {
    it('chains A → B → C via subclasses', async () => {
      const p = setup()
      const { Propagator } = p.classes

      class AddOne extends Propagator {
        body({ input, output }) {
          output({ put: input({}) + 1 })
        }
      }
      p.define({ AddOne })

      const a = p.create.Slot({ value: 0 })
      const b = p.create.Slot({ value: 0 })
      const c = p.create.Slot({ value: 0 })

      p.create.AddOne({ cells: { input: a, output: b } })
      p.create.AddOne({ cells: { input: b, output: c } })
      await flush()

      expect(b({})).toBe(1)
      expect(c({})).toBe(2)

      a({ put: 10 })
      await flush()
      expect(b({})).toBe(11)
      expect(c({})).toBe(12)
    })
  })

  describe('bidirectional cycle with reducers', () => {
    it('converges via monotonic reducer (Max)', async () => {
      const p = setup()
      const { Propagator } = p.classes

      class CtoF extends Propagator {
        body({ celsius, fahrenheit }) {
          fahrenheit({ put: (celsius({}) * 9) / 5 + 32 })
        }
      }
      class FtoC extends Propagator {
        body({ fahrenheit, celsius }) {
          celsius({ put: ((fahrenheit({}) - 32) * 5) / 9 })
        }
      }
      p.define({ CtoF, FtoC })

      const celsius = p.create.Max({ value: 0 })
      const fahrenheit = p.create.Max({ value: 32 })

      p.create.CtoF({ cells: { celsius, fahrenheit } })
      p.create.FtoC({ cells: { fahrenheit, celsius } })
      await flush()

      expect(celsius({})).toBe(0)
      expect(fahrenheit({})).toBe(32)

      celsius({ put: 100 })
      await flush()
      expect(fahrenheit({})).toBe(212)
    })
  })

  describe('reducer prevents infinite loops', () => {
    it('stops when reducer returns same value', async () => {
      const p = setup()
      const { Propagator } = p.classes
      let fireCount = 0

      class Echo extends Propagator {
        body({ a, b }) {
          fireCount++
          b({ put: a({}) })
        }
      }
      p.define({ Echo })

      const a = p.create.Slot({ value: 1 })
      const b = p.create.Slot({ value: 0 })
      p.create.Echo({ cells: { a, b } })
      await flush()

      // fires and terminates (write to b triggers re-schedule, second run is a no-op write)
      expect(b({})).toBe(1)
      const countAfterInit = fireCount

      a({ put: 1 }) // same value → no change event → no re-fire
      await flush()
      expect(fireCount).toBe(countAfterInit)
    })
  })

  describe('custom shouldActivate', () => {
    it('fires with partial bindings when shouldActivate allows it', async () => {
      const p = setup()
      const { Propagator } = p.classes

      class ForwardIfSource extends Propagator {
        shouldActivate({ source }) {
          return source != null
        }
        body({ source, sink }) {
          if (sink) sink({ put: source({}) })
        }
      }
      p.define({ ForwardIfSource })

      const source = p.create.Slot({ value: 42 })
      const output = p.create.Slot({ value: 0 })

      const prop = p.create.ForwardIfSource({ cells: { source, sink: null } })
      await flush()

      // body fired, but sink is null so no write
      expect(output({})).toBe(0)

      prop({ put: output, at: 'sink' })
      await flush()
      expect(output({})).toBe(42)
    })
  })

  describe('resource.propagated event', () => {
    it('fires after body runs', async () => {
      const p = setup()
      const events = []
      p.on('resource.propagated', e => events.push(e))

      const { Propagator } = p.classes
      class Noop extends Propagator {
        body() {}
      }
      p.define({ Noop })

      const x = p.create.Slot({ value: 1 })
      p.create.Noop({ cells: { x } })
      await flush()

      expect(events.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('resource.mounted event on cell bind', () => {
    it('fires mounted when a cell is bound', () => {
      const p = setup()
      const events = []
      p.on('resource.mounted', e => events.push(e))

      const a = p.create.Slot({ value: 1 })
      p.create.Propagator({ cells: { a }, body() {} })

      const mountedNames = events.map(e => e.name)
      expect(mountedNames).toContain('a')
    })
  })

  describe('rebind after unbind', () => {
    it('rewires to new resource after unbind + rebind', async () => {
      const p = setup()
      const { Propagator } = p.classes

      class Copier extends Propagator {
        body({ src, dst }) {
          dst({ put: src({}) })
        }
      }
      p.define({ Copier })

      const src1 = p.create.Slot({ value: 'first' })
      const src2 = p.create.Slot({ value: 'second' })
      const dst = p.create.Slot({ value: '' })

      const prop = p.create.Copier({ cells: { src: src1, dst } })
      await flush()
      expect(dst({})).toBe('first')

      // unbind src, bind new one
      prop({ put: null, at: 'src' })
      prop({ put: src2, at: 'src' })
      await flush()
      expect(dst({})).toBe('second')

      // changing src2 triggers
      src2({ put: 'updated' })
      await flush()
      expect(dst({})).toBe('updated')

      // changing src1 does NOT trigger
      src1({ put: 'stale' })
      await flush()
      expect(dst({})).toBe('updated')
    })
  })

  describe('inline body', () => {
    it('works for one-offs via constructor body option', async () => {
      const p = setup()

      const a = p.create.Slot({ value: 3 })
      const b = p.create.Slot({ value: 4 })
      const result = p.create.Slot({ value: 0 })

      p.create.Propagator({
        cells: { a, b, result },
        body({ a, b, result }) {
          result({ put: a({}) + b({}) })
        },
      })
      await flush()

      expect(result({})).toBe(7)

      a({ put: 10 })
      await flush()
      expect(result({})).toBe(14)
    })
  })

  describe('empty cells', () => {
    it('never fires with empty keyspace', async () => {
      const p = setup()
      let fired = false

      p.create.Propagator({
        cells: {},
        body() {
          fired = true
        },
      })
      await flush()

      expect(fired).toBe(false)
    })
  })

  describe('visitor pattern', () => {
    it('accepts visitPropagator', () => {
      const p = setup()
      const prop = p.create.Propagator({ cells: { a: null }, body() {} })
      const result = p.reflect(prop).accept({
        visitPropagator() {
          return 'propagator'
        },
        visitScope() {
          return 'scope'
        },
        visitResource() {
          return 'resource'
        },
      })
      expect(result).toBe('propagator')
    })

    it('falls back to visitScope', () => {
      const p = setup()
      const prop = p.create.Propagator({ cells: { a: null }, body() {} })
      const result = p.reflect(prop).accept({
        visitScope() {
          return 'scope'
        },
        visitResource() {
          return 'resource'
        },
      })
      expect(result).toBe('scope')
    })

    it('falls back to visitResource', () => {
      const p = setup()
      const prop = p.create.Propagator({ cells: { a: null }, body() {} })
      const result = p.reflect(prop).accept({
        visitResource() {
          return 'resource'
        },
      })
      expect(result).toBe('resource')
    })
  })

  describe('error handling', () => {
    it('onError announces resource.error when body throws', async () => {
      const p = setup()
      const { Propagator } = p.classes
      const errors = []
      p.on('resource.error', e => errors.push(e))

      class Broken extends Propagator {
        body() {
          throw new Error('boom')
        }
      }
      p.define({ Broken })

      const x = p.create.Slot({ value: 1 })
      p.create.Broken({ cells: { x } })
      await flush()

      expect(errors).toHaveLength(1)
      expect(errors[0].error.message).toBe('boom')
    })

    it('onError is overridable by subclass', async () => {
      const p = setup()
      const { Propagator } = p.classes
      const caught = []

      class Resilient extends Propagator {
        body() {
          throw new Error('oops')
        }
        onError(error) {
          caught.push(error)
        }
      }
      p.define({ Resilient })

      const x = p.create.Slot({ value: 1 })
      p.create.Resilient({ cells: { x } })
      await flush()

      expect(caught).toHaveLength(1)
      expect(caught[0].message).toBe('oops')
    })

    it('body error in one propagator does not affect others', async () => {
      const p = setup()
      const { Propagator } = p.classes

      class Broken extends Propagator {
        body() {
          throw new Error('fail')
        }
      }
      class Working extends Propagator {
        body({ input, output }) {
          output({ put: input({}) * 2 })
        }
      }
      p.define({ Broken, Working })

      const input = p.create.Slot({ value: 5 })
      const output = p.create.Slot({ value: 0 })

      p.create.Broken({ cells: { input } })
      p.create.Working({ cells: { input, output } })
      await flush()

      expect(output({})).toBe(10)
    })

    it('base body throws when not overridden', async () => {
      const p = setup()
      const errors = []
      p.on('resource.error', e => errors.push(e))

      const x = p.create.Slot({ value: 1 })
      p.create.Propagator({ cells: { x } })
      await flush()

      expect(errors).toHaveLength(1)
      expect(errors[0].error.message).toBe('body not implemented')
    })
  })

  describe('scheduling', () => {
    it('run() is overridable for custom scheduling', async () => {
      const p = setup()
      const { Propagator } = p.classes
      let executeCount = 0

      class SyncPropagator extends Propagator {
        run() {
          this.execute()
        } // synchronous scheduling
        body() {
          executeCount++
        }
      }
      p.define({ SyncPropagator })

      const x = p.create.Slot({ value: 1 })
      p.create.SyncPropagator({ cells: { x } })

      // synchronous — no flush needed
      expect(executeCount).toBe(1)
    })

    it('deduplicates multiple run() calls in the same tick', async () => {
      const p = setup()
      const { Propagator } = p.classes
      let fireCount = 0

      class Counter extends Propagator {
        body() {
          fireCount++
        }
      }
      p.define({ Counter })

      const a = p.create.Slot({ value: 1 })
      const b = p.create.Slot({ value: 2 })
      const c = p.create.Slot({ value: 3 })
      p.create.Counter({ cells: { a, b, c } })
      await flush()

      const countAfterInit = fireCount

      // three changes in one synchronous block → should coalesce to one execution
      a({ put: 10 })
      b({ put: 20 })
      c({ put: 30 })
      await flush()

      expect(fireCount).toBe(countAfterInit + 1)
    })

    it('does not fire stale microtask after cell unbinding', async () => {
      const p = setup()
      const { Propagator } = p.classes
      let fireCount = 0

      class Adder extends Propagator {
        body() {
          fireCount++
        }
      }
      p.define({ Adder })

      const a = p.create.Slot({ value: 1 })
      const b = p.create.Slot({ value: 2 })
      const prop = p.create.Adder({ cells: { a, b } })
      // microtask is queued but hasn't fired yet — unbind a
      prop({ put: null, at: 'a' })
      await flush()

      // body should NOT have fired — shouldActivate check in execute() prevents it
      expect(fireCount).toBe(0)
    })
  })

  describe('Union change detection', () => {
    it('propagator reacts when Union accumulates a new value', async () => {
      const p = setup()
      const { Propagator } = p.classes

      class Watcher extends Propagator {
        body({ tags, count }) {
          const s = tags({})
          count({ put: s.size })
        }
      }
      p.define({ Watcher })

      const tags = p.create.Union()
      const count = p.create.Slot({ value: 0 })

      p.create.Watcher({ cells: { tags, count } })
      await flush()
      expect(count({})).toBe(0)

      tags({ put: 'a' })
      await flush()
      expect(count({})).toBe(1)

      tags({ put: 'b' })
      await flush()
      expect(count({})).toBe(2)

      // duplicate — no change, propagator should not re-fire
      const countBefore = count({})
      tags({ put: 'a' })
      await flush()
      expect(count({})).toBe(countBefore)
    })
  })

  describe('listener cleanup', () => {
    it('unsubscribes from resource.changed when all cells are unbound', async () => {
      const p = setup()
      const { Propagator } = p.classes
      let fireCount = 0

      class Counter extends Propagator {
        shouldActivate() {
          return true
        }
        body() {
          fireCount++
        }
      }
      p.define({ Counter })

      const a = p.create.Slot({ value: 1 })
      const b = p.create.Slot({ value: 2 })
      const prop = p.create.Counter({ cells: { a, b } })
      await flush()

      // unbind both cells — the unbind itself may trigger runs
      prop({ put: null, at: 'a' })
      prop({ put: null, at: 'b' })
      await flush()
      const countAfterUnbind = fireCount

      // changes to formerly watched resources should not trigger
      a({ put: 99 })
      b({ put: 99 })
      await flush()
      expect(fireCount).toBe(countAfterUnbind)
    })

    it('re-subscribes after unbind-all then rebind', async () => {
      const p = setup()
      const { Propagator } = p.classes

      class Copier extends Propagator {
        body({ src, dst }) {
          dst({ put: src({}) })
        }
      }
      p.define({ Copier })

      const src = p.create.Slot({ value: 1 })
      const dst = p.create.Slot({ value: 0 })
      const prop = p.create.Copier({ cells: { src, dst } })
      await flush()
      expect(dst({})).toBe(1)

      // unbind all
      prop({ put: null, at: 'src' })
      prop({ put: null, at: 'dst' })
      await flush()

      // rebind
      prop({ put: src, at: 'src' })
      prop({ put: dst, at: 'dst' })
      await flush()
      expect(dst({})).toBe(1)

      // should still react
      src({ put: 42 })
      await flush()
      expect(dst({})).toBe(42)
    })
  })

  describe('walk and meta passthrough', () => {
    it('walk resolves through propagator cells', async () => {
      const p = setup()
      const leaf = p.create.Slot({ value: 42 })
      const inner = p.create.Scope({ entries: { leaf } })
      const prop = p.create.Propagator({ cells: { inner }, body() {} })
      await flush()

      const result = prop({ walk: 'inner/leaf' })
      expect(result).toBe(leaf)
      expect(result({})).toBe(42)
    })

    it('meta returns metadata for bound cells', () => {
      const p = setup()
      const a = p.create.Slot({ value: 1 })
      const prop = p.create.Propagator({ cells: { a }, body() {} })

      // mount with meta via put protocol
      // first need to add b to keyspace — can't, keyspace is fixed
      // meta works on existing cells mounted with meta in scope
      expect(prop({ meta: 'a' })).toBe(null)
    })
  })
})
