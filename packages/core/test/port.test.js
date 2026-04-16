import { describe, it, expect } from 'vitest'
import {
  port,
  net,
  EOF,
  is,
  propagator,
  offer,
  accept,
  hasCap,
} from '../src/bassline.js'
import { collect, filledPort } from './utils.js'
import { vi } from 'vitest'

describe('port', () => {
  it('delivers values in order', async () => {
    const values = [1, 2, 3, 4, 5]
    const { recv } = filledPort(values)
    expect(await collect(recv)).toEqual(values)
  })

  it('drains buffer before returning EOF', async () => {
    const values = ['a', 'b']
    const p = filledPort(values)
    expect(await p.recv()).toBe(values[0])
    expect(await p.recv()).toBe(values[1])
    expect(await p.recv()).toBe(EOF)
  })

  it('resolves pending recv with EOF on close', async () => {
    const p = port()
    const pending = p.recv()
    p.close()
    await expect(pending).resolves.toBe(EOF)
  })

  it('drops sends after close', async () => {
    const p = port()
    p.send(1)
    p.close()
    p.send(2)
    await expect(collect(p.recv)).resolves.toEqual([1])
  })

  it('throws when sending EOF', () => {
    const p = port()
    expect(() => p.send(EOF)).toThrow('Bassline EOF is reserved')
    p.close()
  })
})

describe('port sliding buffer', () => {
  it('drops oldest values beyond size', async () => {
    const p = port(2)
    p.send(1)
    p.send(2)
    p.send(3) // drops 1
    p.send(4) // drops 2
    p.close()
    expect(await collect(p.recv)).toEqual([3, 4])
  })

  it('size=1 keeps only the latest value', async () => {
    const p = port(1)
    p.send('a')
    p.send('b')
    p.send('c')
    p.close()
    expect(await collect(p.recv)).toEqual(['c'])
  })

  it('size=0 drops all if nobody is waiting', async () => {
    const p = port(0)
    p.send(1)
    p.send(2)
    p.close()
    expect(await p.recv()).toBe(EOF)
  })

  it('size=0 delivers if someone is waiting', async () => {
    const p = port(0)
    const pending = p.recv()
    p.send(42)
    expect(await pending).toBe(42)
    p.close()
  })
})

describe('net', () => {
  it('broadcasts to all participants', async () => {
    const { join } = net()
    const a = join()
    const b = join()
    const c = join()

    a.send('hello')
    b.close()
    c.close()

    expect(await b.recv()).toBe('hello')
    expect(await c.recv()).toBe('hello')

    a.close()
  })

  it('does not receive own messages', async () => {
    const { join } = net()
    const a = join()
    const b = join()

    a.send('from-a')
    b.send('from-b')

    expect(await a.recv()).toBe('from-b')
    expect(await b.recv()).toBe('from-a')

    a.close()
    b.close()
  })

  it('close removes from routing and produces EOF', async () => {
    const { join } = net()
    const a = join()
    const b = join()

    a.close()
    b.send('after-close')

    // a's recv should return EOF since we closed
    expect(await a.recv()).toBe(EOF)
    b.close()
  })
})

describe('isEOF', () => {
  it('returns true for EOF', () => {
    expect(is.eof(EOF)).toBe(true)
  })

  it('returns false for other values', () => {
    expect(is.eof(null)).toBe(false)
    expect(is.eof(undefined)).toBe(false)
    expect(is.eof(42)).toBe(false)
    expect(is.eof(Symbol())).toBe(false)
  })
})

describe('propagator', () => {
  const counter = () => {
    const c = {
      count: 0,
      inc: () => c.count++,
    }
    return c
  }

  it('propagates', () => {
    const c = counter()
    const p = propagator()
    const remove = p.to(c.inc)
    p.send(10)
    p.send(10)
    remove()
    p.send(10)

    expect(c.count).toEqual(2)
  })

  it('attenuates', () => {
    const c = counter()
    const p = propagator((v, p) => v < 5 && p(v))
    p.to(c.inc)

    p.send(1)
    p.send(2)
    p.send(6)

    expect(c.count).toEqual(2)
  })

  it('handles cycles', () => {
    let n = 0
    const a = propagator((v, p) => p(v + 1))
    const b = propagator((v, p) => {
      if (v >= 10) n = v
      else p(v + 1)
    })
    a.to(b.send)
    b.to(a.send)

    a.send(1)

    expect(n).toEqual(10)

    b.send(20)

    expect(n).toEqual(20)
  })

  it('handles close', () => {
    const c = counter()
    const a = propagator()
    a.to(c.inc)

    a.send(1)

    expect(c.count).toEqual(1)

    a.close()

    a.send(1)

    expect(c.count).toEqual(1)
  })
})

describe('capabilities', () => {
  const [A, B, C] = [Symbol(), Symbol(), Symbol()]
  const simpleMsg = { x: 1, y: 2 }

  async function pipeline(
    values,
    offerSyms = [A, B, C],
    acceptSyms = offerSyms
  ) {
    const offerHandlers = {}
    offerSyms.forEach(s => (offerHandlers[s] = vi.fn(() => {})))
    const acceptHandlers = {}
    acceptSyms.forEach(s => (acceptHandlers[s] = vi.fn((msg, cap) => cap(msg))))

    const o = offer(offerHandlers)
    const a = accept(acceptHandlers)
    const passthrough = []
    o.to(a.send)
    a.to(msg => passthrough.push(msg))

    await Promise.all(values.map(o.send))
    return { offerHandlers, acceptHandlers, passthrough }
  }

  it('enriches message with symbol capability', async () => {
    const { passthrough } = await pipeline([simpleMsg, simpleMsg], [A])
    for (const msg of passthrough) {
      expect(hasCap(msg, A)).toBe(true)
    }
  })

  it('preserves original message keys', async () => {
    const {
      passthrough: [msg],
    } = await pipeline([simpleMsg])
    expect(msg.x).toBe(1)
    expect(msg.y).toBe(2)
  })

  it('handles multiple symbols', async () => {
    const {
      passthrough: [msg],
    } = await pipeline([simpleMsg])
    for (const s of [A, B, C]) {
      expect(hasCap(msg, s)).toBe(true)
    }
  })

  it('calling the cap invokes the offer handler', async () => {
    const { offerHandlers } = await pipeline([simpleMsg])
    for (const s of [A, B, C]) {
      expect(offerHandlers[s]).toHaveBeenCalledOnce()
    }
  })

  it('accept calls handler when cap is present', async () => {
    const { acceptHandlers } = await pipeline([simpleMsg], [A], [A])
    expect(acceptHandlers[A]).toHaveBeenCalledOnce()
  })

  it('accept skips handler when cap is absent', async () => {
    const { acceptHandlers } = await pipeline([simpleMsg], [A], [B])
    expect(acceptHandlers[B]).not.toHaveBeenCalled()
  })

  it('accept always passes message through', async () => {
    const { passthrough } = await pipeline([simpleMsg, simpleMsg], [A], [B])
    expect(passthrough.length).toBe(2)
  })

  it('only fires matching symbols from partial overlap', async () => {
    const { offerHandlers, acceptHandlers } = await pipeline(
      [simpleMsg],
      [A, B],
      [A, C]
    )
    // A: offered and accepted
    expect(offerHandlers[A]).toHaveBeenCalledOnce()
    expect(acceptHandlers[A]).toHaveBeenCalledOnce()
    // B: offered but not accepted
    expect(offerHandlers[B]).not.toHaveBeenCalled()
    // C: accepted but not offered
    expect(acceptHandlers[C]).not.toHaveBeenCalled()
  })

  it('roundtrip: accept invokes cap, offer handler receives result', async () => {
    const SYN = Symbol('syn')
    const acked = []

    const o = offer({ [SYN]: msg => acked.push(msg) })
    const a = accept({ [SYN]: (msg, cap) => cap({ from: msg.body }) })
    o.to(a.send)

    o.send({ body: 'ping' })
    expect(acked).toEqual([{ from: 'ping' }])
  })
})
