import { describe, it, expect } from 'vitest'
import { message, Fault, fault } from '../src/bassline.js'

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
