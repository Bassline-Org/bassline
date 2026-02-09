import { describe, it, expect } from 'vitest'
import { resource, slot, slots, RESOURCE, isResource, DNU, KeyNotFound, adapt, pipe, watchable } from '../src/alt/index.js'

describe('resource', () => {
  it('returns a callable function with RESOURCE symbol', () => {
    const r = resource()
    expect(typeof r).toBe('function')
    expect(r[RESOURCE]).toBe(true)
  })

  it('isResource returns true for resources', () => {
    expect(isResource(resource())).toBe(true)
    expect(isResource(slot())).toBe(true)
    expect(isResource(slots())).toBe(true)
  })

  it('isResource returns false for plain objects and functions', () => {
    expect(isResource({})).toBeFalsy()
    expect(isResource(() => {})).toBeFalsy()
  })

  it('default get throws DNU', () => {
    const r = resource()
    expect(() => r()).toThrow(DNU)
  })

  it('default put throws DNU', () => {
    const r = resource()
    expect(() => r({ put: 'x' })).toThrow(DNU)
  })

  it('dispatches to get when no put key in message', () => {
    const r = resource({ get(msg) { return msg.foo } })
    expect(r({ foo: 'bar' })).toBe('bar')
  })

  it('dispatches to put when put key present, separating body from rest', () => {
    const r = resource({
      put(body, rest) { return { body, rest } }
    })
    expect(r({ put: 'value', extra: 1 })).toEqual({ body: 'value', rest: { extra: 1 } })
  })

  it('this in handlers is bound to merged options', () => {
    const r = resource({
      count: 0,
      get() { return this.count },
      put(v) { this.count += v; return this.count }
    })
    expect(r()).toBe(0)
    r({ put: 3 })
    expect(r()).toBe(3)
    r({ put: 2 })
    expect(r()).toBe(5)
  })

  it('empty call passes {} as default message', () => {
    const r = resource({ get(msg) { return msg } })
    expect(r()).toEqual({})
  })

  it('custom dnu handler on options gets called instead of throwing', () => {
    let called = 0
    const r = resource({
      dnu(msg) { called++ }
    })
    r()
    r({ put: 'x' })
    expect(called).toBe(2)
  })
})

describe('slot', () => {
  it('is a resource', () => {
    const s = slot(10)
    expect(s[RESOURCE]).toBe(true)
    expect(isResource(s)).toBe(true)
  })

  it('get returns initial value', () => {
    expect(slot(42)()).toBe(42)
  })

  it('put changes and returns new value', () => {
    const s = slot(1)
    expect(s({ put: 2 })).toBe(2)
    expect(s()).toBe(2)
  })

  it('handles falsy values: 0, false, null, empty string', () => {
    expect(slot(0)()).toBe(0)
    expect(slot(false)()).toBe(false)
    expect(slot(null)()).toBe(null)
    expect(slot('')()).toBe('')
  })

  it('no initial value returns undefined', () => {
    expect(slot()()).toBeUndefined()
  })

  it('put undefined goes to put path', () => {
    const s = slot('initial')
    s({ put: undefined })
    expect(s()).toBeUndefined()
  })
})

describe('slots', () => {
  it('is a resource', () => {
    const ss = slots()
    expect(ss[RESOURCE]).toBe(true)
    expect(isResource(ss)).toBe(true)
  })

  it('put at key then get at key', () => {
    const ss = slots()
    ss({ at: 'x', put: 10 })
    expect(ss({ at: 'x' })).toBe(10)
  })

  it('put overwrites existing', () => {
    const ss = slots()
    ss({ at: 'x', put: 1 })
    ss({ at: 'x', put: 2 })
    expect(ss({ at: 'x' })).toBe(2)
  })

  it('multiple independent keys', () => {
    const ss = slots()
    ss({ at: 'a', put: 1 })
    ss({ at: 'b', put: 2 })
    expect(ss({ at: 'a' })).toBe(1)
    expect(ss({ at: 'b' })).toBe(2)
  })

  it('ifAbsentPut creates on miss', () => {
    const ss = slots()
    expect(ss({ at: 'x', ifAbsentPut: 99 })).toBe(99)
  })

  it('ifAbsentPut returns existing on hit', () => {
    const ss = slots()
    ss({ at: 'x', put: 5 })
    expect(ss({ at: 'x', ifAbsentPut: 99 })).toBe(5)
  })

  it('ifAbsentPut persists the created slot', () => {
    const ss = slots()
    ss({ at: 'x', ifAbsentPut: 42 })
    expect(ss({ at: 'x' })).toBe(42)
  })

  it('put null deletes — returns true if existed', () => {
    const ss = slots()
    ss({ at: 'x', put: 1 })
    expect(ss({ at: 'x', put: null })).toBe(true)
  })

  it('put null returns false if key did not exist', () => {
    const ss = slots()
    expect(ss({ at: 'x', put: null })).toBe(false)
  })

  it('KeyNotFound thrown on get of missing key', () => {
    const ss = slots()
    expect(() => ss({ at: 'missing' })).toThrow(KeyNotFound)
  })

  it('DNU thrown on get without at key', () => {
    const ss = slots()
    expect(() => ss({ foo: 'bar' })).toThrow(DNU)
  })

  it('DNU thrown on put without at key', () => {
    const ss = slots()
    expect(() => ss({ put: 'val' })).toThrow(DNU)
  })
})

describe('adapt', () => {
  it('is a resource', () => {
    const a = adapt(slot(0))
    expect(a[RESOURCE]).toBe(true)
    expect(isResource(a)).toBe(true)
  })

  it('transparent proxy forwards get', () => {
    const s = slot(42)
    const a = adapt(s)
    expect(a()).toBe(42)
  })

  it('transparent proxy forwards put', () => {
    const s = slot(0)
    const a = adapt(s)
    a({ put: 10 })
    expect(s()).toBe(10)
    expect(a()).toBe(10)
  })

  it('input transforms message before forwarding', () => {
    const r = resource({
      get(msg) { return msg.x }
    })
    const a = adapt(r, {
      input(msg) { return { ...msg, x: (msg.x ?? 0) + 1 } }
    })
    expect(a({ x: 5 })).toBe(6)
  })

  it('output transforms result after forwarding', () => {
    const s = slot(10)
    const a = adapt(s, {
      output(result) { return result * 2 }
    })
    expect(a()).toBe(20)
  })

  it('input and output compose (profunctor)', () => {
    const s = slot(0)
    const a = adapt(s, {
      input(msg) { return msg },
      output(result) { return result + 100 }
    })
    a({ put: 5 })
    expect(s()).toBe(5)
    expect(a()).toBe(105)
  })

  it('custom state on options accessible via this', () => {
    const s = slot(0)
    const a = adapt(s, {
      calls: 0,
      input(msg) { this.calls++; return msg },
    })
    a()
    a()
    a({ put: 1 })
    expect(a.options.calls).toBe(3)
  })

  it('get/put overrides bypass dnu pipeline', () => {
    const s = slot(0)
    const outputCalls = []
    const a = adapt(s, {
      output(result) { outputCalls.push(result); return result },
      get(msg) { return this.target(msg) + 1000 },
    })
    // get override bypasses dnu, so output is NOT called
    expect(a()).toBe(1000)
    expect(outputCalls).toEqual([])
    // put still goes through dnu pipeline (not overridden)
    a({ put: 5 })
    expect(outputCalls).toEqual([5])
  })

  it('adapters chain: A(B(target))', () => {
    const s = slot(1)
    const double = adapt(s, {
      output(result) { return result * 2 }
    })
    const addTen = adapt(double, {
      output(result) { return result + 10 }
    })
    expect(addTen()).toBe(12) // (1 * 2) + 10
  })

  it('target accessible as this.target', () => {
    const s = slot(99)
    const a = adapt(s, {
      get() { return this.target() }
    })
    expect(a()).toBe(99)
  })
})

describe('pipe', () => {
  it('composes functions left to right', () => {
    const f = pipe(x => x + 1, x => x * 2)
    expect(f(3)).toBe(8) // (3 + 1) * 2
  })

  it('single function passes through', () => {
    const f = pipe(x => x + 1)
    expect(f(5)).toBe(6)
  })

  it('works with adapt input/output', () => {
    const s = slot(0)
    const a = adapt(s, {
      output: pipe(x => x + 1, x => x * 10)
    })
    a({ put: 5 })
    expect(a()).toBe(60) // (5 + 1) * 10
  })
})

describe('watchable', () => {
  it('is a resource', () => {
    const w = watchable(slot(0))
    expect(w[RESOURCE]).toBe(true)
    expect(isResource(w)).toBe(true)
  })

  it('forwards get to target', () => {
    const w = watchable(slot(42))
    expect(w()).toBe(42)
  })

  it('forwards put to target', () => {
    const s = slot(0)
    const w = watchable(s)
    w({ put: 10 })
    expect(s()).toBe(10)
    expect(w()).toBe(10)
  })

  it('notifies watchers on put with changed and prev', () => {
    const w = watchable(slot(0))
    const notifications = []
    const listener = resource({
      put(value) { notifications.push(value) }
    })
    w({ watch: listener })
    w({ put: 5 })
    w({ put: 10 })
    expect(notifications).toEqual([
      { changed: 5, prev: 0 },
      { changed: 10, prev: 5 },
    ])
  })

  it('unwatch stops notifications', () => {
    const w = watchable(slot(0))
    const notifications = []
    const listener = resource({
      put(value) { notifications.push(value) }
    })
    w({ watch: listener })
    w({ put: 1 })
    w({ unwatch: listener })
    w({ put: 2 })
    expect(notifications).toEqual([
      { changed: 1, prev: 0 },
    ])
  })

  it('multiple watchers all notified', () => {
    const w = watchable(slot(0))
    const a = [], b = []
    w({ watch: resource({ put(v) { a.push(v) } }) })
    w({ watch: resource({ put(v) { b.push(v) } }) })
    w({ put: 7 })
    expect(a).toEqual([{ changed: 7, prev: 0 }])
    expect(b).toEqual([{ changed: 7, prev: 0 }])
  })

  it('watch/unwatch return undefined (no forwarding)', () => {
    const w = watchable(slot(0))
    const listener = resource({ put() {} })
    expect(w({ watch: listener })).toBeUndefined()
    expect(w({ unwatch: listener })).toBeUndefined()
  })
})

describe('errors', () => {
  it('DNU is an Error instance', () => {
    const e = new DNU({}, 'msg')
    expect(e).toBeInstanceOf(Error)
    expect(e).toBeInstanceOf(DNU)
  })

  it('DNU message includes resource and msg info', () => {
    const e = new DNU('res', 'test')
    expect(e.message).toContain('res')
    expect(e.message).toContain('test')
  })

  it('KeyNotFound is an Error instance', () => {
    const e = new KeyNotFound({}, 'mykey')
    expect(e).toBeInstanceOf(Error)
    expect(e).toBeInstanceOf(KeyNotFound)
  })

  it('KeyNotFound message includes key info', () => {
    const e = new KeyNotFound({}, 'mykey')
    expect(e.message).toContain('mykey')
  })
})
