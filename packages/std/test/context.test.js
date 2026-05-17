import { describe, it, expect, vi } from 'vitest'
import { context, conversation, dialogue } from '../src/context.js'
import { mold, isLoadMsg } from '../src/wire.js'
import { AssertionFailure, Msg, msg, port } from '@bassline/core'

const nonMessages = [
  123,
  'hello',
  { hello: 'world' },
  [1, 2, 3],
  null,
  undefined,
]

describe('context', () => {
  it('exposes mintId, resolveId, dispatch, clear, entries', () => {
    const ctx = context()
    expect(ctx.mintId).toBeInstanceOf(Function)
    expect(ctx.resolveId).toBeInstanceOf(Function)
    expect(ctx.dispatch).toBeInstanceOf(Function)
    expect(ctx.clear).toBeInstanceOf(Function)
    expect(ctx.entries).toBeInstanceOf(Function)
  })

  describe('mintId', () => {
    it('rejects non-functions', () => {
      const { mintId } = context()
      for (const v of nonMessages) {
        expect(() => mintId(v)).toThrow(AssertionFailure)
      }
    })

    it('returns a string id and registers the function', () => {
      const { mintId, entries } = context()
      const id = mintId(() => {})
      expect(typeof id).toBe('string')
      expect(entries()).toContain(id)
    })

    it('mints distinct ids for the same function', () => {
      const { mintId } = context()
      const fn = () => {}
      expect(mintId(fn)).not.toBe(mintId(fn))
    })
  })

  describe('resolveId', () => {
    it('returns the parked function for a known id', () => {
      const { mintId, resolveId } = context()
      const fn = () => {}
      const id = mintId(fn)
      expect(resolveId(id)).toBe(fn)
    })

    it('returns undefined for an unknown id', () => {
      const { resolveId } = context()
      expect(resolveId('nope')).toBeUndefined()
    })
  })

  describe('dispatch', () => {
    it('rejects non-messages', () => {
      const { dispatch } = context()
      for (const v of nonMessages) {
        expect(() => dispatch(v)).toThrow(AssertionFailure)
      }
    })

    it('returns aMsg when there is no via', () => {
      const { dispatch } = context()
      const m = msg({ hello: 'world' })
      expect(dispatch(m)).toBe(m)
    })

    it('returns aMsg when via does not match a parked id', () => {
      const { dispatch } = context()
      const m = msg({ via: 'no-such-id' })
      expect(dispatch(m)).toBe(m)
    })

    it('invokes the parked cap with via stripped, and returns undefined', () => {
      const { mintId, dispatch } = context()
      const fn = vi.fn()
      const id = mintId(fn)
      const result = dispatch(msg({ via: id, payload: 1 }))
      expect(result).toBeUndefined()
      expect(fn).toHaveBeenCalledTimes(1)
      const arg = fn.mock.calls[0][0]
      expect(arg.has('via')).toBe(false)
      expect(arg.get('payload')).toBe(1)
    })
  })

  describe('clear', () => {
    it('empties the registry', () => {
      const { mintId, entries, clear } = context()
      mintId(() => {})
      mintId(() => {})
      expect(entries().length).toBe(2)
      clear()
      expect(entries().length).toBe(0)
    })
  })

  it('mold + dispatch cycle: parked cap fires when via comes back', () => {
    const ctx = context()
    const fn = vi.fn()
    const original = msg().grantCaps({ ping: fn })
    const molded = mold(original, ctx.mintId)
    const id = molded.loadMessage.caps.ping
    const result = ctx.dispatch(msg({ via: id, x: 1 }))
    expect(result).toBeUndefined()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn.mock.calls[0][0].get('x')).toBe(1)
  })
})

function pair() {
  const [a, recvA] = port()
  const [b, recvB] = port()
  return { aSide: [b, recvA], bSide: [a, recvB] }
}

describe('conversation', () => {
  it('molds outgoing messages and sends a shell Msg through the delegate', () => {
    const ctx = context()
    const delegate = msg().grantCaps({ send: vi.fn() })
    const [, recv] = port()
    const [conv] = conversation(delegate, {
      recv,
      mintId: ctx.mintId,
      dispatch: ctx.dispatch,
    })
    const m = msg({ hello: 'world' })
    conv.send(m)
    expect(delegate.caps.send).toHaveBeenCalledTimes(1)
    const sent = delegate.caps.send.mock.calls[0][0]
    expect(isLoadMsg(sent)).toBe(true)
    expect(sent.get('loadMessage')).toEqual({
      data: { hello: 'world' },
      caps: {},
    })
  })

  it('parks caps on outgoing messages in the context', () => {
    const ctx = context()
    const delegate = msg().grantCaps({ send: vi.fn() })
    const [, recv] = port()
    const [conv] = conversation(delegate, {
      recv,
      mintId: ctx.mintId,
      dispatch: ctx.dispatch,
    })
    conv.send(msg().grantCaps({ ack: () => {} }))
    const sent = delegate.caps.send.mock.calls[0][0]
    const id = sent.get('loadMessage').caps.ack
    expect(ctx.entries()).toContain(id)
  })

  it('binds caps on incoming messages', async () => {
    const { aSide, bSide } = pair()
    const ctxA = context()
    const ctxB = context()
    const [convA] = conversation(aSide[0], {
      recv: aSide[1],
      mintId: ctxA.mintId,
      dispatch: ctxA.dispatch,
    })
    const [, ontoB] = conversation(bSide[0], {
      recv: bSide[1],
      mintId: ctxB.mintId,
      dispatch: ctxB.dispatch,
    })

    convA.send(msg({ greet: 'hi' }).grantCaps({ ack: () => {} }))

    const recvd = await new Promise(r => ontoB(r))
    expect(recvd.get('greet')).toBe('hi')
    expect(recvd.capKeys).toContain('ack')
    expect(recvd.has('loadMessage')).toBe(false)
  })

  it('propagates plain (non-loadMessage) incoming messages untouched', async () => {
    const { aSide, bSide } = pair()
    const ctxB = context()
    const [, ontoB] = conversation(bSide[0], {
      recv: bSide[1],
      mintId: ctxB.mintId,
      dispatch: ctxB.dispatch,
    })

    // bypass conversation on A's side and send a plain msg directly
    aSide[0].send(msg({ heartbeat: true }))
    const recvd = await new Promise(r => ontoB(r))
    expect(recvd.get('heartbeat')).toBe(true)
  })

  it('end-to-end: invoking a bound cap routes back to the parked function', async () => {
    const { aSide, bSide } = pair()
    const ctxA = context()
    const ctxB = context()
    const [convA] = conversation(aSide[0], {
      recv: aSide[1],
      mintId: ctxA.mintId,
      dispatch: ctxA.dispatch,
    })
    const [, ontoB] = conversation(bSide[0], {
      recv: bSide[1],
      mintId: ctxB.mintId,
      dispatch: ctxB.dispatch,
    })

    const ack = vi.fn()
    convA.send(msg({ greet: 'hi' }).grantCaps({ ack }))

    const recvd = await new Promise(r => ontoB(r))
    recvd.invoke('ack', msg({ ok: true }))
    await new Promise(r => setTimeout(r, 0))
    expect(ack).toHaveBeenCalledTimes(1)
    expect(ack.mock.calls[0][0].get('ok')).toBe(true)
  })

  it('closing the conversation closes its recv loop', () => {
    const { dispatch, mintId } = context()
    const delegate = msg().grantCaps({ send: vi.fn() })
    const [, recv] = port()
    const [conv] = conversation(delegate, { recv, mintId, dispatch })
    conv.close()
    expect(conv.closed).toBe(true)
  })
})

describe('dialogue', () => {
  it('creates a fresh context and returns a conversation', () => {
    const [a, recv] = port()
    const [conv, onMsg] = dialogue([a, recv])
    expect(conv).toBeInstanceOf(Msg)
    expect(conv.capableOf(['send', 'close'])).toBe(true)
    expect(onMsg).toBeInstanceOf(Function)
  })

  it('closing the delegate closes the conversation', () => {
    const [a, recv] = port()
    const [conv] = dialogue([a, recv])
    expect(conv.closed).toBe(false)
    a.close()
    expect(conv.closed).toBe(true)
  })

  it('closing the conversation closes the delegate', () => {
    const [a, recv] = port()
    const [conv] = dialogue([a, recv])
    expect(a.closed).toBe(false)
    conv.close()
    expect(a.closed).toBe(true)
  })

  it('end-to-end roundtrip with cap invocation', async () => {
    const { aSide, bSide } = pair()
    const [convA] = dialogue(aSide)
    const [, onB] = dialogue(bSide)

    const ack = vi.fn()
    convA.send(msg({ hello: 'world' }).grantCaps({ ack }))

    const recvd = await new Promise(r => onB(r))
    expect(recvd.get('hello')).toBe('world')

    recvd.invoke('ack', msg({ ok: 1 }))
    await new Promise(r => setTimeout(r, 0))
    expect(ack).toHaveBeenCalledTimes(1)
    expect(ack.mock.calls[0][0].get('ok')).toBe(1)
  })
})
