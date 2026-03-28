import { describe, it, expect } from 'vitest'
import { message, update, subst, isEmpty, Fault, fault } from '../src/messages.js'

describe('message', () => {
  it('normalizes undefined to empty object', () => {
    expect(message()).toEqual({})
    expect(message(undefined)).toEqual({})
  })

  it('copies plain objects', () => {
    const orig = { temperature: 72 }
    const msg = message(orig)
    expect(msg).toEqual({ temperature: 72 })
    expect(msg).not.toBe(orig) // shallow copy, not same reference
  })

  it('wraps primitives in body', () => {
    expect(message(42)).toEqual({ body: 42 })
    expect(message('hello')).toEqual({ body: 'hello' })
    expect(message(true)).toEqual({ body: true })
  })

  it('wraps null in body', () => {
    expect(message(null)).toEqual({ body: null })
  })

  it('wraps arrays in body', () => {
    expect(message([1, 2, 3])).toEqual({ body: [1, 2, 3] })
  })

  it('produces plain objects, not instances', () => {
    const msg = message({ a: 1 })
    expect(Object.getPrototypeOf(msg)).toBe(Object.prototype)
  })
})

describe('update', () => {
  it('applies fn and merges (two args)', () => {
    const msg = { temperature: 72 }
    const result = update(msg, () => ({ ...msg, seen: true }))
    expect(result).toEqual({ temperature: 72, seen: true })
  })

  it('fn receives the original message', () => {
    const msg = { temperature: 72 }
    const result = update(msg, m => ({ ...m, warm: m.temperature > 70 }))
    expect(result).toEqual({ temperature: 72, warm: true })
  })

  it('returns a transform when curried (one arg)', () => {
    const addSeen = update(msg => ({ ...msg, seen: true }))
    expect(typeof addSeen).toBe('function')
    expect(addSeen({ temperature: 72 })).toEqual({ temperature: 72, seen: true })
  })

  it('curried form works in pipelines', () => {
    const msgs = [{ a: 1 }, { a: 2 }, { a: 3 }]
    const transform = update(m => ({ ...m, doubled: m.a * 2 }))
    const results = msgs.map(transform)
    expect(results).toEqual([
      { a: 1, doubled: 2 },
      { a: 2, doubled: 4 },
      { a: 3, doubled: 6 },
    ])
  })

  it('produces plain objects', () => {
    const result = update({ x: 1 }, () => ({ y: 2 }))
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
  })

  it('curried and direct forms are equivalent', () => {
    const msg = { a: 1, b: 2 }
    const fn = m => ({ sum: m.a + m.b })
    expect(update(msg, fn)).toEqual(update(fn)(msg))
  })

  it('throws on invalid arity', () => {
    expect(() => update(1, 2, 3)).toThrow('invalid update arity')
  })
})

describe('isEmpty', () => {
  it('true for empty object', () => {
    expect(isEmpty({})).toBe(true)
  })

  it('false for non-empty object', () => {
    expect(isEmpty({ a: 1 })).toBe(false)
  })

  it('true for message()', () => {
    expect(isEmpty(message())).toBe(true)
  })
})

describe('subst', () => {
  it('rewrites string leaves from let bindings into in', () => {
    const msg = {
      let: {
        foo: { a: 1 },
        bar: { b: 2 },
      },
      in: {
        left: 'foo',
        right: ['bar', 'foo'],
      },
    }

    expect(subst(msg)).toEqual({
      left: { a: 1 },
      right: [{ b: 2 }, { a: 1 }],
    })
  })

  it('leaves unknown strings unchanged', () => {
    expect(subst({ let: { foo: { a: 1 } }, in: { left: 'foo', right: 'baz' } })).toEqual({
      left: { a: 1 },
      right: 'baz',
    })
  })

  it('does a single non-recursive substitution pass', () => {
    const msg = {
      let: {
        foo: { body: 'bar' },
        bar: { body: 42 },
      },
      in: {
        value: 'foo',
      },
    }

    expect(subst(msg)).toEqual({
      value: { body: 'bar' },
    })
  })

  it('does not require bindings to know about each other', () => {
    const msg = {
      let: {
        foo: 'bar',
        bar: { answer: 42 },
      },
      in: { values: ['foo', 'bar'] },
    }

    expect(subst(msg)).toEqual({ values: ['bar', { answer: 42 }] })
  })
})

describe('Fault', () => {
  it('is an instance of Error', () => {
    const f = new Fault('not-found', { path: '/x' })
    expect(f).toBeInstanceOf(Error)
  })

  it('carries condition, msg, and context', () => {
    const f = new Fault('timeout', { id: 1 }, { elapsed: 5000 })
    expect(f.condition).toBe('timeout')
    expect(f.msg).toEqual({ id: 1 })
    expect(f.context).toEqual({ elapsed: 5000 })
  })

  it('has a descriptive error message', () => {
    const f = new Fault('bad-input', {})
    expect(f.message).toBe('fault: bad-input')
  })

  it('defaults context to empty object', () => {
    const f = new Fault('oops', {})
    expect(f.context).toEqual({})
  })
})

describe('fault', () => {
  it('throws a Fault', () => {
    expect(() => {
      throw fault('boom', { x: 1 })
    }).toThrow(Fault)
  })

  it('thrown Fault has correct fields', () => {
    expect.assertions(3)
    try {
      throw fault('boom', { x: 1 }, { retry: true })
    } catch (e) {
      expect(e.condition).toBe('boom')
      expect(e.msg).toEqual({ x: 1 })
      expect(e.context).toEqual({ retry: true })
    }
  })
})
