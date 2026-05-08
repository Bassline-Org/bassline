import { describe, it, expect } from 'vitest'
import { msg } from '../src/bassline.js'

describe('message', () => {
  it('normalizes undefined to empty object', () => {
    expect(msg().data).toEqual({})
    expect(msg(undefined).data).toEqual({})
  })

  it('copies plain objects', () => {
    const orig = { temperature: 72 }
    const m = msg().merge(orig)
    expect(m.data).toEqual({ temperature: 72 })
    expect(m.data).not.toBe(orig) // shallow copy, not same reference
  })

  it('throw with primitives', () => {
    expect(() => msg().merge(42)).toThrow('data must be an object')
    expect(() => msg().merge('hello')).toThrow('data must be an object')
    expect(() => msg().merge(true)).toThrow('data must be an object')
  })

  it('throws on arrays', () => {
    expect(() => msg().merge([1, 2, 3])).toThrow('data must be an object')
  })

  it('works on objects', () => {
    expect(msg().merge({ hello: 'world' }).data).toEqual({ hello: 'world' })
  })
})
