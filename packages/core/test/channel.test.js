import { describe, it, expect } from 'vitest'
import { channel, slidingChannel, clock, Channel, ConsumedChannelError } from '../src/channel.js'

// helper: collect all values from a reader into an array
async function collect(reader) {
  const values = []
  await reader.sink(v => values.push(v))
  return values
}

describe('channel lifecycle', () => {
  it('delivers values in order', async () => {
    const [read, write] = channel()
    write.send(1)
    write.send(2)
    write.send(3)
    write.close()
    expect(await collect(read)).toEqual([1, 2, 3])
  })

  it('delivers all queued values before signaling done', async () => {
    const [read, write] = channel()
    write.send('a')
    write.send('b')
    write.send('c')
    write.close()

    const values = []
    for await (const v of read.consume()) {
      values.push(v)
    }
    expect(values).toEqual(['a', 'b', 'c'])
  })

  it('sink resolves when writer closes', async () => {
    const [read, write] = channel()
    write.close()
    const values = await collect(read)
    expect(values).toEqual([])
  })

  it('works when consumer waits for producer', async () => {
    const [read, write] = channel()

    // start consuming before any values are written
    const collecting = collect(read)

    // write after a microtask
    await Promise.resolve()
    write.send(1)
    write.send(2)
    write.close()

    expect(await collecting).toEqual([1, 2])
  })
})

describe('single consumption', () => {
  it('throws ConsumedChannelError on second consume', () => {
    const [read, write] = channel()
    write.close()
    read.consume() // first consume
    expect(() => read.consume()).toThrow(ConsumedChannelError)
  })

  it('sink counts as consuming', () => {
    const [read, write] = channel()
    write.close()
    read.sink(() => {}) // consumes
    expect(() => read.consume()).toThrow(ConsumedChannelError)
  })
})

describe('error handling', () => {
  it('rejects sink when error with empty queue', async () => {
    const [read, write] = channel()
    const error = new Error('boom')
    write.err(error)
    await expect(collect(read)).rejects.toBe(error)
  })

  it('delivers queued values then errors', async () => {
    const [read, write] = channel()
    write.send(1)
    write.send(2)
    write.err(new Error('after values'))

    const values = []
    try {
      await read.sink(v => values.push(v))
    } catch (e) {
      expect(e.message).toBe('after values')
    }
    expect(values).toEqual([1, 2])
  })
})

describe('state transitions', () => {
  it('write after close is a no-op', async () => {
    const [read, write] = channel()
    write.send(1)
    write.close()
    write.send(2) // should be ignored
    expect(await collect(read)).toEqual([1])
  })

  it('write after err is a no-op', async () => {
    const [read, write] = channel()
    write.err(new Error('x'))
    write.send(1) // should be ignored
    await expect(collect(read)).rejects.toThrow()
  })

  it('close after close is a no-op', async () => {
    const [read, write] = channel()
    write.close()
    write.close() // no throw
    expect(await collect(read)).toEqual([])
  })

  it('err after close is a no-op', async () => {
    const [read, write] = channel()
    write.close()
    write.err(new Error('too late')) // no throw, no effect
    expect(await collect(read)).toEqual([])
  })
})

describe('writer', () => {
  it('send accepts multiple values', async () => {
    const [read, write] = channel()
    write.send(1, 2, 3)
    write.close()
    expect(await collect(read)).toEqual([1, 2, 3])
  })
})

describe('iterator protocol', () => {
  it('return closes channel and resolves with value', async () => {
    const chan = new Channel()
    chan.send(1)
    const iter = chan.consume()[Symbol.asyncIterator]()

    const first = await iter.next()
    expect(first).toEqual({ value: 1, done: false })

    const ret = await iter.return('fin')
    expect(ret).toEqual({ value: 'fin', done: true })

    // channel is now closed
    const after = await iter.next()
    expect(after).toEqual({ value: undefined, done: true })
  })

  it('throw errors the channel', async () => {
    const chan = new Channel()
    const iter = chan.consume()[Symbol.asyncIterator]()
    const error = new Error('injected')

    // per async iterator protocol, throw should resolve (not reject)
    const result = await iter.throw(error)
    expect(result).toEqual({ value: error, done: true })
  })
})

describe('SlidingChannel', () => {
  it('drops oldest values beyond size', async () => {
    const [read, write] = slidingChannel(2)
    write.send(1)
    write.send(2)
    write.send(3) // should drop 1
    write.send(4) // should drop 2
    write.close()
    expect(await collect(read)).toEqual([3, 4])
  })

  it('size=1 keeps only the latest value', async () => {
    const [read, write] = slidingChannel(1)
    write.send('a')
    write.send('b')
    write.send('c')
    write.close()
    expect(await collect(read)).toEqual(['c'])
  })
})

describe('ClockChannel', () => {
  it('emits timestamps and can be closed', async () => {
    const [read, write] = clock(10) // 10ms interval
    await read.take(2).sink(v => {
      expect(typeof v).toBe('number')
    })
    write.close()
  })

  it('writer only exposes close', () => {
    const [_, write] = clock(1000)
    expect(write.close).toBeDefined()
    expect(write.send).toBeUndefined()
    write.close()
  })
})
