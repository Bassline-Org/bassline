import { describe, it, expect, vi } from 'vitest'
import { call, lambda, withResolver } from '../src/lambda.js'
import { scalar } from '../src/data/index.js'
import { msg, Msg } from '@bassline/core'

describe('smoke', () => {
  it('should create a lambda', () => {
    const m = lambda(() => {})
    expect(m).toBeInstanceOf(Msg)
  })
})

describe('behavior', () => {
  it('should be callable', async () => {
    const m = lambda(vi.fn(() => {}))
    const res = await call(m, msg())
    expect(res).toBeInstanceOf(Msg)
    expect(res.keys).toEqual([])
    expect(res.capKeys).toEqual([])
  })

  it('should ignore messages without resolve & reject caps', async () => {
    const fn = vi.fn(() => {})
    const l = lambda(fn)
    l.invoke('call', msg())
    expect(fn).not.toHaveBeenCalled()
  })

  it('should compute when handed correct caps', async () => {
    const fn = vi.fn(() => scalar(123))
    const l = lambda(fn)
    const res = await call(l, msg({ hello: 'world' }))

    expect(fn).toHaveBeenCalledTimes(1)
    expect(res).toBeInstanceOf(Msg)
    expect(res.data).toMatchObject({ scalar: 123 })
  })

  it('should catch errors and invoke the reject cap', async () => {
    const l = lambda(() => {
      throw new Error('oops')
    })
    const promise = call(l, msg({ hello: 'world' }))
    await expect(promise).rejects.toThrow(Msg)
    const res = await promise.catch(e => e)
    expect(res).toMatchObject({
      data: {
        error: 'oops',
      },
    })
  })

  it('should throw for non (msg | fn | undefined) returns', async () => {
    const l = lambda(() => 123)
    const p = call(l, scalar(123))
    await expect(p).rejects.toThrow(Msg)
    const res = await p.catch(e => e)
    expect(res.get('error')).toMatch('invalid result:')
  })

  it('should handle curried functions', async () => {
    const expectLambda = aMsg => {
      expect(aMsg).toBeInstanceOf(Msg)
      expect(aMsg.capableOf('call')).toBe(true)
    }
    const l = lambda(a => b => scalar(a.get('scalar') + b.get('scalar')))

    const a = await call(l, scalar(10))
    expectLambda(a)
    const b = await call(a, scalar(20))
    expect(b).toBeInstanceOf(Msg)
    expect(b.get('scalar')).toBe(30)
    const c = await call(a, scalar(100))
    expect(c).toBeInstanceOf(Msg)
    expect(c.get('scalar')).toBe(110)
  })
})

describe('lifecycle', () => {
  it('should close the request msg after a non-curried call', async () => {
    const l = lambda(() => msg({ ok: true }))
    const resolver = msg()
    const p = withResolver(resolver)
    l.invoke('call', resolver)
    await p
    expect(resolver.closed).toBe(true)
  })

  it('should keep the request msg alive after a curried call', async () => {
    const resolver = msg()
    const l = lambda(_a => _b => msg({}))
    const p = withResolver(resolver)
    l.invoke('call', resolver)
    await p
    expect(resolver.closed).toBe(false)
  })

  it('should close the curried child when the parent lambda closes', async () => {
    const l = lambda(_a => _b => msg({}))
    const m = await call(l, msg({}))
    expect(m.capableOf('call')).toBe(true)
    expect(m.closed).toBe(false)
    l.close()
    expect(m.closed).toBe(true)
  })
})
