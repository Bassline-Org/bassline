import { describe, it, expect, vi } from 'vitest'
import { createCache, bindRawCaps } from '../src/cache.js'
import { AssertionFailure, msg, Msg } from '@bassline/core'

const exampleMsg = msg({ hello: 'world' }).grantCaps({
  foo: vi.fn(() => {}),
})
const nonMessages = [
  123,
  'hello',
  { hello: 'world' },
  [1, 2, 3],
  null,
  undefined,
]

describe('smoke', () => {
  const [handle, cache] = createCache()
  it('message created correctly', () => {
    expect(handle).toBeInstanceOf(Msg)
    expect(handle.capableOf(['send', 'close'])).toBe(true)
  })
  it('locals produced correctly', () => {
    expect(cache.toData).toBeInstanceOf(Function)
    expect(cache.onMsg).toBeInstanceOf(Function)
    expect(cache.dispatch).toBeInstanceOf(Function)
    expect(cache.entries).toBeInstanceOf(Function)
  })
})

describe('toData', () => {
  const [_handle, cache] = createCache()
  const a = exampleMsg.copy()
  const size = () => cache.entries().length
  it('should reject non-messages', () => {
    for (const v of nonMessages) {
      expect(() => {
        cache.toData(v)
      }).toThrow(AssertionFailure)
    }
    expect(size()).toBe(0)
  })

  it('should accept messages', () => {
    const parked = cache.toData(a)
    expect(parked).toBeInstanceOf(Msg)
    expect(size()).toBe(1)
  })

  it('should be idempotent', () => {
    const parked = cache.toData(a)
    const anotherParked = cache.toData(a)
    expect(parked).toBe(anotherParked)
    expect(size()).toBe(1)
  })

  it('should allow parking data messages', () => {
    const parked = cache.toData(a)
    const parkedTwice = cache.toData(parked)
    expect(parked).not.toBe(parkedTwice)
    expect(size()).toBe(2)
  })

  it('should produce a message without caps', () => {
    const parked = cache.toData(a)
    expect(parked.capKeys.length).toBe(0)
    expect(a.capKeys.length).toBe(1)
  })

  it('should produce a message with caps as data', () => {
    const parked = cache.toData(a)
    expect(Object.keys(parked.get('capabilities'))).toEqual(a.capKeys)
  })

  it('should remove closed messages', () => {
    const sizeBefore = size()
    const b = a.copy()
    const parked = cache.toData(b)

    expect(b.closed).toBe(false)
    expect(parked.closed).toBe(false)
    expect(size()).toBe(sizeBefore + 1)

    b.close()

    expect(b.closed).toBe(true)
    expect(parked.closed).toBe(true)
    expect(size()).toBe(sizeBefore)
  })

  it('should cascade closes', () => {
    const foo = cache.toData(a)
    const bar = cache.toData(foo)
    const baz = cache.toData(bar)
    expect(foo.closed && bar.closed && baz.closed).toBe(false)

    a.close()
    expect(foo.closed && bar.closed && baz.closed).toBe(true)
    expect(size()).toBe(0)
  })
})

describe('bindRawCaps', () => {
  const [handle, cache] = createCache()
  const a = exampleMsg.copy()

  const parked = cache.toData(a.copy())
  const fromParked = bindRawCaps(parked, handle)

  it('should reject non messages', () => {
    for (const v of nonMessages) {
      expect(() => bindRawCaps(v, handle)).toThrow(AssertionFailure)
    }
  })

  it('should reject invalid delegates', () => {
    for (const v of nonMessages) {
      expect(() => bindRawCaps(parked, v)).toThrow(AssertionFailure)
    }
  })

  it('should rehydrate dataified messages', () => {
    expect(parked).toBeInstanceOf(Msg)
    expect(fromParked).toBeInstanceOf(Msg)
  })

  it('should remove the capabilities key', () => {
    expect(parked.has('capabilities')).toBe(true)
    expect(fromParked.has('capabilities')).toBe(false)
  })

  it('should have the same caps by spelling', () => {
    expect(a.capKeys).toEqual(fromParked.capKeys)
  })

  it('should have the same impl for the caps', () => {
    const foo = exampleMsg.caps.foo
    a.invoke('foo')
    fromParked.invoke('foo')
    expect(foo).toHaveBeenCalledTimes(2)
    parked.invoke('foo')
    expect(foo).toHaveBeenCalledTimes(2)
  })

  it('should make caps no-ops when cache is closed', () => {
    const foo = exampleMsg.caps.foo
    expect(foo).toHaveBeenCalledTimes(2)
    handle.close()
    a.invoke('foo')
    fromParked.invoke('foo')
    expect(foo).toHaveBeenCalledTimes(3)
  })
})
