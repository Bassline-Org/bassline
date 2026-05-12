import { describe, it, expect, vi } from 'vitest'
import { call, createPromise, lambda } from '../src/lambda.js'
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
    const req = call(m)
    const res = await req()
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
    const fn = vi.fn(() => msg({ scalar: 123 }))
    const l = lambda(fn)
    const c = call(l)

    const res = await c(msg({ hello: 'world' }))

    expect(fn).toHaveBeenCalledTimes(1)
    expect(res).toBeInstanceOf(Msg)
    expect(res.data).toMatchObject({ scalar: 123 })
  })

  it('should catch errors and invoke the reject cap', async () => {
    const l = lambda(() => {
      throw new Error('oops')
    })
    const c = call(l)
    const promise = c(msg({ hello: 'world' }))
    await expect(promise).rejects.toThrow(Msg)
    const res = await promise.catch(e => e)
    expect(res).toMatchObject({
      data: {
        error: 'oops',
      },
    })
  })

  const callLambda = async (aLambda, scalar) =>
    await call(aLambda)(msg({ scalar }))

  it('should throw for non (msg | fn | undefined) returns', async () => {
    const l = lambda(() => 123)
    const p = callLambda(l)
    await expect(p).rejects.toThrow(Msg)
    const res = await p.catch(e => e)
    expect(res.get('error')).toMatch('invalid result:')
  })

  it('should handle curried functions', async () => {
    const expectLambda = aMsg => {
      expect(aMsg).toBeInstanceOf(Msg)
      expect(aMsg.capableOf('call')).toBe(true)
    }
    const l = lambda(
      a => b => msg({ scalar: a.get('scalar') + b.get('scalar') })
    )

    const a = await callLambda(l, 10)
    expectLambda(a)
    const b = await callLambda(a, 20)
    expect(b).toBeInstanceOf(Msg)
    expect(b.get('scalar')).toBe(30)
    const c = await callLambda(a, 100)
    expect(c).toBeInstanceOf(Msg)
    expect(c.get('scalar')).toBe(110)
  })
})

describe('lifecycle', () => {
  it('should close the request msg after a non-curried call', async () => {
    const [resolver, promise] = createPromise()
    const l = lambda(() => msg({ ok: true }))
    l.invoke('call', resolver)
    await promise
    expect(resolver.closed).toBe(true)
  })

  it('should keep the request msg alive after a curried call', async () => {
    const [resolver, promise] = createPromise()
    const l = lambda(_a => _b => msg({}))
    l.invoke('call', resolver)
    await promise
    expect(resolver.closed).toBe(false)
  })

  it('should close the curried child when the parent lambda closes', async () => {
    const l = lambda(_a => _b => msg({}))
    const m = await call(l)(msg({}))
    expect(m.capableOf('call')).toBe(true)
    expect(m.closed).toBe(false)
    l.close()
    expect(m.closed).toBe(true)
  })

  it('should close the originating request when the curried child closes', async () => {
    const [resolver, promise] = createPromise()
    const l = lambda(_a => _b => msg({}))
    l.invoke('call', resolver)
    const m = await promise
    expect(resolver.closed).toBe(false)
    m.close()
    expect(resolver.closed).toBe(true)
  })
})
