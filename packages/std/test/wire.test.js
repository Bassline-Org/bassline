import { describe, it, expect, vi } from 'vitest'
import { mold, load, isLoadMsg } from '../src/wire.js'
import { msg, Msg, failure, AssertionFailure } from '@bassline/core'

function makeContext() {
  const byId = new Map()
  let counter = 0
  const mintId = closure => {
    const id = `cap-${++counter}`
    byId.set(id, closure)
    return id
  }
  const resolveId = id => {
    const fn = byId.get(id)
    if (!fn) throw failure(`makeContext: no cap for id ${id}`)
    return fn
  }
  return { mintId, resolveId, byId }
}

describe('mold', () => {
  it('rejects non-Msg input', () => {
    const { mintId } = makeContext()
    for (const v of [123, 'x', { foo: 1 }, [1, 2], null, undefined]) {
      expect(() => mold(v, mintId)).toThrow(AssertionFailure)
    }
  })

  it('rejects non-function mintId', () => {
    expect(() => mold(msg({ a: 1 }), null)).toThrow(AssertionFailure)
  })

  it('wraps a no-cap Msg', () => {
    const { mintId } = makeContext()
    const out = mold(msg({ a: 1 }), mintId)
    expect(out).toEqual({ loadMessage: { data: { a: 1 }, caps: {} } })
  })

  it('wraps a cap-bearing Msg and mints ids', () => {
    const { mintId, byId } = makeContext()
    const fn = vi.fn()
    const out = mold(msg({ a: 1 }).grantCaps({ ping: fn }), mintId)
    expect(out.loadMessage.data).toEqual({ a: 1 })
    expect(Object.keys(out.loadMessage.caps)).toEqual(['ping'])
    const id = out.loadMessage.caps.ping
    expect(byId.has(id)).toBe(true)
  })

  it('the minted closure invokes the cap when called', () => {
    const { mintId, byId } = makeContext()
    const fn = vi.fn()
    const m = msg().grantCaps({ ping: fn })
    const out = mold(m, mintId)
    const id = out.loadMessage.caps.ping
    const arg = msg({ x: 1 })
    byId.get(id)(arg)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn.mock.calls[0][0]).toBe(arg)
  })

  it('descends into nested plain objects and arrays', () => {
    const { mintId } = makeContext()
    const out = mold(
      msg({ list: [1, 2, { deep: 'x' }], obj: { a: 1 } }),
      mintId
    )
    expect(out.loadMessage.data).toEqual({
      list: [1, 2, { deep: 'x' }],
      obj: { a: 1 },
    })
  })

  it('molds nested Msg in data inline', () => {
    const { mintId } = makeContext()
    const inner = msg({ inner: true }).grantCaps({ ack: () => {} })
    const outer = msg({ payload: inner })
    const out = mold(outer, mintId)
    expect(out.loadMessage.data.payload.loadMessage.data).toEqual({
      inner: true,
    })
    expect(Object.keys(out.loadMessage.data.payload.loadMessage.caps)).toEqual([
      'ack',
    ])
  })

  it('molds Msg buried inside arrays and objects', () => {
    const { mintId } = makeContext()
    const a = msg({ tag: 'a' })
    const b = msg({ tag: 'b' })
    const outer = msg({ list: [a, { nested: b }] })
    const out = mold(outer, mintId)
    expect(out.loadMessage.data.list[0]).toEqual({
      loadMessage: { data: { tag: 'a' }, caps: {} },
    })
    expect(out.loadMessage.data.list[1].nested).toEqual({
      loadMessage: { data: { tag: 'b' }, caps: {} },
    })
  })

  it('does not double-wrap a no-cap shell over an already-molded payload', () => {
    const { mintId } = makeContext()
    const payload = { data: { a: 1 }, caps: { ping: 'cap-99' } }
    const already = { loadMessage: payload }
    const out = mold(msg(already), mintId)
    expect(out).toEqual(already)
    expect(out.loadMessage).toBe(payload)
  })

  it('does wrap when the shell has caps even if data is a loadMessage form', () => {
    const { mintId } = makeContext()
    const already = {
      loadMessage: { data: { a: 1 }, caps: {} },
    }
    const out = mold(msg(already).grantCaps({ wrap: () => {} }), mintId)
    expect(out.loadMessage.data).toEqual(already)
    expect(Object.keys(out.loadMessage.caps)).toEqual(['wrap'])
  })

  it('does wrap when extra keys sit alongside loadMessage in data', () => {
    const { mintId } = makeContext()
    const data = {
      loadMessage: { data: {}, caps: {} },
      other: 'sibling',
    }
    const out = mold(msg(data), mintId)
    expect(out.loadMessage.data).toEqual(data)
  })

  it('passes scalars and null through', () => {
    const { mintId } = makeContext()
    const data = { n: 1, s: 'x', b: true, z: null, arr: [null, false, 0] }
    const out = mold(msg(data), mintId)
    expect(out.loadMessage.data).toEqual(data)
  })
})

describe('isLoadMsg', () => {
  it('is true for a Msg whose data has a loadMessage key', () => {
    expect(isLoadMsg(msg({ loadMessage: { data: {}, caps: {} } }))).toBe(true)
  })
  it('is false for a Msg without loadMessage in data', () => {
    expect(isLoadMsg(msg({ a: 1 }))).toBe(false)
  })
  it('is false for non-Msg values', () => {
    for (const v of [123, 'x', { loadMessage: {} }, null, undefined]) {
      expect(isLoadMsg(v)).toBe(false)
    }
  })
})

describe('load', () => {
  it('rejects scalars, arrays, null, and undefined', () => {
    const { resolveId } = makeContext()
    for (const v of [123, 'x', [1, 2], null, undefined]) {
      expect(() => load(v, resolveId)).toThrow(AssertionFailure)
    }
  })

  it('wraps a plain object without LOAD into a Msg (idempotent no-op)', () => {
    const { resolveId } = makeContext()
    const out = load({ foo: 1 }, resolveId)
    expect(out).toBeInstanceOf(Msg)
    expect(out.get('foo')).toBe(1)
  })

  it('is a no-op for a Msg without loadMessage data', () => {
    const { resolveId } = makeContext()
    const m = msg({ hello: 'world' })
    expect(load(m, resolveId)).toBe(m)
    expect(m.get('hello')).toBe('world')
  })

  it('does not require resolveId when input is a no-op', () => {
    expect(() => load(msg({ a: 1 }), null)).not.toThrow()
    expect(() => load({ foo: 1 }, null)).not.toThrow()
  })

  it('rejects non-function resolveId when binding', () => {
    expect(() =>
      load(msg({ loadMessage: { data: {}, caps: {} } }), null)
    ).toThrow(AssertionFailure)
  })

  it('hydrates a no-cap loadMessage Msg', () => {
    const { resolveId } = makeContext()
    const m = load(
      msg({ loadMessage: { data: { a: 1 }, caps: {} } }),
      resolveId
    )
    expect(m).toBeInstanceOf(Msg)
    expect(m.get('a')).toBe(1)
    expect(m.has('loadMessage')).toBe(false)
    expect(m.capKeys).toEqual([])
  })

  it('hydrates caps via resolveId', () => {
    const { mintId, resolveId } = makeContext()
    const fn = vi.fn()
    const original = msg().grantCaps({ ping: fn })
    const molded = msg(mold(original, mintId))
    const hydrated = load(molded, resolveId)
    expect(hydrated.capKeys).toEqual(['ping'])
    const arg = msg({ x: 1 })
    hydrated.invoke('ping', arg)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn.mock.calls[0][0]).toBe(arg)
  })

  it('hydrates nested loadMessage forms in data', () => {
    const { mintId, resolveId } = makeContext()
    const inner = msg({ inner: true }).grantCaps({ ack: vi.fn() })
    const outer = msg({ payload: inner, plain: 42 })
    const molded = msg(mold(outer, mintId))
    const hydrated = load(molded, resolveId)
    expect(hydrated.get('plain')).toBe(42)
    const innerHydrated = hydrated.get('payload')
    expect(innerHydrated).toBeInstanceOf(Msg)
    expect(innerHydrated.get('inner')).toBe(true)
    expect(innerHydrated.capKeys).toEqual(['ack'])
  })

  it('hydrates Msg buried inside arrays', () => {
    const { mintId, resolveId } = makeContext()
    const a = msg({ tag: 'a' })
    const molded = msg(mold(msg({ list: [a, 'plain'] }), mintId))
    const hydrated = load(molded, resolveId)
    const list = hydrated.get('list')
    expect(list[0]).toBeInstanceOf(Msg)
    expect(list[0].get('tag')).toBe('a')
    expect(list[1]).toBe('plain')
  })

  it('a second load on an already-bound Msg is a no-op', () => {
    const { mintId, resolveId } = makeContext()
    const original = msg({ a: 1 }).grantCaps({ ping: vi.fn() })
    const hydrated = load(msg(mold(original, mintId)), resolveId)
    const again = load(hydrated, resolveId)
    expect(again).toBe(hydrated)
  })
})

describe('roundtrip', () => {
  it('preserves data shape for a no-cap Msg', () => {
    const { mintId, resolveId } = makeContext()
    const original = msg({ a: 1, b: [2, { c: 'three' }] })
    const hydrated = load(msg(mold(original, mintId)), resolveId)
    expect(hydrated.data).toEqual(original.data)
  })

  it('preserves a deeply nested Msg tree', () => {
    const { mintId, resolveId } = makeContext()
    const leaf = msg({ leaf: true }).grantCaps({ poke: vi.fn() })
    const middle = msg({ mid: 'm', child: leaf })
    const root = msg({ root: 'r', child: middle })
    const hydrated = load(msg(mold(root, mintId)), resolveId)
    const mid = hydrated.get('child')
    const lf = mid.get('child')
    expect(mid).toBeInstanceOf(Msg)
    expect(lf).toBeInstanceOf(Msg)
    expect(lf.capKeys).toEqual(['poke'])
  })

  it('the molded form roundtrips through JSON', () => {
    const { mintId, resolveId } = makeContext()
    const inner = msg({ inner: true }).grantCaps({ ack: vi.fn() })
    const outer = msg({ a: 1, child: inner }).grantCaps({ ping: vi.fn() })
    const json = JSON.parse(JSON.stringify(mold(outer, mintId)))
    const hydrated = load(msg(json), resolveId)
    expect(hydrated.get('a')).toBe(1)
    expect(hydrated.capKeys).toEqual(['ping'])
    expect(hydrated.get('child').capKeys).toEqual(['ack'])
  })

  it('mold(load(...)) returns equivalent json shape', () => {
    const { mintId, resolveId } = makeContext()
    const original = msg({ a: 1 }).grantCaps({ ping: vi.fn() })
    const json = mold(original, mintId)
    const hydrated = load(msg(json), resolveId)
    const remolded = mold(hydrated, mintId)
    expect(remolded.loadMessage.data).toEqual(json.loadMessage.data)
    expect(Object.keys(remolded.loadMessage.caps)).toEqual(
      Object.keys(json.loadMessage.caps)
    )
  })
})
