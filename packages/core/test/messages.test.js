import { describe, it, expect } from 'vitest'
import { message, kindOf } from '../src/bassline.js'

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

describe('kindOf', () => {
  it('distinguishes null from undefined', () => {
    expect(kindOf(null)).toBe('null')
    expect(kindOf(undefined)).toBe('undefined')
  })

  it('identifies promises', () => {
    expect(kindOf(Promise.resolve())).toBe('promise')
    expect(kindOf(new Promise(() => {}))).toBe('promise')
  })

  it('identifies arrays (not object)', () => {
    expect(kindOf([])).toBe('array')
    expect(kindOf([1, 2, 3])).toBe('array')
  })

  it('falls through to typeof for everything else', () => {
    expect(kindOf(42)).toBe('number')
    expect(kindOf('hello')).toBe('string')
    expect(kindOf(true)).toBe('boolean')
    expect(kindOf(Symbol())).toBe('symbol')
    expect(kindOf(() => {})).toBe('function')
    expect(kindOf({})).toBe('object')
  })
})
