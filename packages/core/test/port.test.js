import { describe, it, expect } from 'vitest'
import { port, net, EOF, is, propagator } from '../src/bassline.js'
import { collect, filledPort } from './utils.js'

describe('port', () => {
  it('delivers values in order', async () => {
    const values = [1, 2, 3, 4, 5]
    const [_, recv] = filledPort(values)
    expect(await collect(recv)).toEqual(values)
  })

  it('drains buffer before returning EOF', async () => {
    const values = ['a', 'b']
    const [_, recv] = filledPort(values)
    expect(await recv()).toBe(values[0])
    expect(await recv()).toBe(values[1])
    expect(await recv()).toBe(EOF)
  })

  it('resolves pending recv with EOF on close', async () => {
    const [p, recv] = port()
    const pending = recv()
    p.close()
    await expect(pending).resolves.toBe(EOF)
  })

  it('drops sends after close', async () => {
    const [p, recv] = port()
    p.send(1)
    p.close()
    p.send(2)
    await expect(collect(recv)).resolves.toEqual([1])
  })

  it('throws when sending EOF', () => {
    const [p] = port()
    expect(() => p.send(EOF)).toThrow('Bassline EOF is reserved')
    p.close()
  })
})

describe('port sliding buffer', () => {
  it('drops oldest values beyond size', async () => {
    const [p, recv] = port(2)
    p.send(1)
    p.send(2)
    p.send(3) // drops 1
    p.send(4) // drops 2
    p.close()
    expect(await collect(recv)).toEqual([3, 4])
  })

  it('size=1 keeps only the latest value', async () => {
    const [p, recv] = port(1)
    p.send('a')
    p.send('b')
    p.send('c')
    p.close()
    expect(await collect(recv)).toEqual(['c'])
  })

  it('size=0 drops all if nobody is waiting', async () => {
    const [p, recv] = port(0)
    p.send(1)
    p.send(2)
    p.close()
    expect(await recv()).toBe(EOF)
  })

  it('size=0 delivers if someone is waiting', async () => {
    const [p, recv] = port(0)
    const pending = recv()
    p.send(42)
    expect(await pending).toBe(42)
    p.close()
  })
})

describe('net', () => {
  it('broadcasts to all participants', async () => {
    const [_msg, join] = net()
    const [a] = join()
    const [b, recvB] = join()
    const [c, recvC] = join()

    a.send('hello')
    b.close()
    c.close()

    expect(await recvB()).toBe('hello')
    expect(await recvC()).toBe('hello')

    a.close()
  })

  it('does not receive own messages', async () => {
    const [_, join] = net()
    const [a, recva] = join()
    const [b, recvb] = join()

    a.send('from-a')
    b.send('from-b')

    expect(await recva()).toBe('from-b')
    expect(await recvb()).toBe('from-a')

    a.close()
    b.close()
  })

  it('close removes from routing and produces EOF', async () => {
    const [, join] = net()
    const [a, recva] = join()
    const [b] = join()

    a.close()
    b.send('after-close')

    // a's recv should return EOF since we closed
    expect(await recva()).toBe(EOF)
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
    const [p, to] = propagator()
    const remove = to(c.inc)
    p.send(10)
    p.send(10)
    remove()
    p.send(10)

    expect(c.count).toEqual(2)
  })

  it('attenuates', () => {
    const c = counter()
    const [p, to] = propagator((v, p) => v < 5 && p(v))
    to(c.inc)

    p.send(1)
    p.send(2)
    p.send(6)

    expect(c.count).toEqual(2)
  })

  it('handles cycles', () => {
    let n = 0
    const [a, ato] = propagator((v, p) => p(v + 1))
    const [b, bto] = propagator((v, p) => {
      if (v >= 10) n = v
      else p(v + 1)
    })
    ato(v => b.send(v))
    bto(v => a.send(v))

    a.send(1)

    expect(n).toEqual(10)

    b.send(20)

    expect(n).toEqual(20)
  })

  it('handles close', () => {
    const c = counter()
    const [a, to] = propagator()
    to(c.inc)

    a.send(1)

    expect(c.count).toEqual(1)

    a.close()

    a.send(1)

    expect(c.count).toEqual(1)
  })
})
