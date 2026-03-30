import { describe, it, expect } from 'vitest'
import { port, net, clock, consume, EOF, isEOF, propagator } from '../src/comm.js'

async function collect(recv) {
  const values = []
  await consume(recv, v => values.push(v))
  return values
}

describe('port', () => {
  it('delivers values in order', async () => {
    const p = port()
    p.send(1)
    p.send(2)
    p.send(3)
    p.close()
    expect(await collect(p.recv)).toEqual([1, 2, 3])
  })

  it('drains buffer before returning EOF', async () => {
    const p = port()
    p.send('a')
    p.send('b')
    p.close()
    expect(await p.recv()).toBe('a')
    expect(await p.recv()).toBe('b')
    expect(await p.recv()).toBe(EOF)
  })

  it('resolves pending recv with EOF on close', async () => {
    const p = port()
    const pending = p.recv()
    p.close()
    expect(await pending).toBe(EOF)
  })

  it('works when consumer waits for producer', async () => {
    const p = port()
    const collecting = collect(p.recv)
    await Promise.resolve()
    p.send(1)
    p.send(2)
    p.close()
    expect(await collecting).toEqual([1, 2])
  })

  it('drops sends after close', async () => {
    const p = port()
    p.send(1)
    p.close()
    p.send(2)
    expect(await collect(p.recv)).toEqual([1])
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
    const join = net()
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
    const join = net()
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
    const join = net()
    const a = join()
    const b = join()

    a.close()
    b.send('after-close')

    // a's recv should return EOF since we closed
    expect(await a.recv()).toBe(EOF)
    b.close()
  })
})

describe('clock', () => {
  it('emits timestamps', async () => {
    const c = clock(10)
    const msg = await c.recv()
    expect(isEOF(msg)).toBe(false)
    expect(msg.ts).toBeTypeOf('number')
    c.close()
  })

  it('close produces EOF after draining buffer', async () => {
    const c = clock(10)
    c.close()
    // first recv drains the initial tick
    const first = await c.recv()
    expect(isEOF(first)).toBe(false)
    // second recv gets EOF
    expect(await c.recv()).toBe(EOF)
  })
})

describe('consume', () => {
  it('processes all messages until EOF', async () => {
    const p = port()
    p.send(1)
    p.send(2)
    p.send(3)
    p.close()

    const values = []
    await consume(p.recv, v => values.push(v))
    expect(values).toEqual([1, 2, 3])
  })

  it('handles async callbacks', async () => {
    const p = port()
    p.send('a')
    p.send('b')
    p.close()

    const values = []
    await consume(p.recv, async v => {
      await new Promise(r => setTimeout(r, 5))
      values.push(v)
    })
    expect(values).toEqual(['a', 'b'])
  })
})

describe('isEOF', () => {
  it('returns true for EOF', () => {
    expect(isEOF(EOF)).toBe(true)
  })

  it('returns false for other values', () => {
    expect(isEOF(null)).toBe(false)
    expect(isEOF(undefined)).toBe(false)
    expect(isEOF(42)).toBe(false)
    expect(isEOF(Symbol())).toBe(false)
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
