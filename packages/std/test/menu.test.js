import { describe, it, expect } from 'vitest'
import { menu } from '../src/menu.js'
import { AssertionFailure, msg, Msg, failure } from '@bassline/core'
import { lambda, withResolver } from '../src/lambda.js'

describe('smoke', () => {
  it('should create a menu', () => {
    const m = menu({})
    expect(m).toBeInstanceOf(Msg)
  })
})

describe('creating with functions', () => {
  const m = menu({
    foo: msg,
    bar: () => msg({ scalar: 123 }),
    oops: () => {
      throw failure('oops')
    },
  })

  it('should allow creation with functions', () => {
    expect(m.capableOf(['foo', 'bar'])).toBe(true)
  })

  it('should allow "calling" with the verbs', async () => {
    const req = msg({ hello: 'world' })
    const promise = withResolver(req)
    m.invoke('bar', req)
    await expect(promise).resolves.toBeInstanceOf(Msg)
    const res = await promise
    expect(res.get('scalar')).toBe(123)
  })

  it('should error when not providing functions', () => {
    expect(() => menu({ foo: 123 })).toThrow(AssertionFailure)
  })

  it('should error when not given an object', () => {
    expect(() => menu([])).toThrow('invalid verbs:')
    expect(() => menu()).toThrow('invalid verbs:')
  })
})

describe('creating with messages', () => {
  const foo = lambda(() => msg({ scalar: 123 }))
  const bar = lambda(() => msg({ scalar: 456 }))
  it('should allow construction with lambdas', () => {
    const m = menu({ foo, bar })
    expect(m).toBeInstanceOf(Msg)
  })
})
