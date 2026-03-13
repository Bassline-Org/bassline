import { describe, it, expect } from 'vitest'
import { channel, merge } from '../src/channel.js'
import { update } from '../src/messages.js'

// helper: create a channel with values already written and closed
function of(...values) {
  const [read, write] = channel()
  values.forEach(v => write.send(v))
  write.close()
  return read
}

// helper: collect all values from a reader
async function collect(reader) {
  const values = []
  await reader.sink(v => values.push(v))
  return values
}

describe('map', () => {
  it('transforms each value', async () => {
    const result = await collect(of(1, 2, 3).map(v => v * 2))
    expect(result).toEqual([2, 4, 6])
  })

  it('supports async transforms', async () => {
    const result = await collect(
      of(1, 2).map(async v => {
        await new Promise(r => setTimeout(r, 1))
        return v + 10
      })
    )
    expect(result).toEqual([11, 12])
  })

  it('propagates close', async () => {
    const result = await collect(of().map(v => v))
    expect(result).toEqual([])
  })

  it('works with curried update', async () => {
    const result = await collect(of({ a: 1 }, { a: 2 }).map(update(m => ({ doubled: m.a * 2 }))))
    expect(result).toEqual([
      { a: 1, doubled: 2 },
      { a: 2, doubled: 4 },
    ])
  })
})

describe('filter', () => {
  it('keeps matching values', async () => {
    const result = await collect(of(1, 2, 3, 4, 5).filter(v => v > 3))
    expect(result).toEqual([4, 5])
  })

  it('supports async predicates', async () => {
    const result = await collect(of(1, 2, 3).filter(async v => v !== 2))
    expect(result).toEqual([1, 3])
  })

  it('empty result when nothing matches', async () => {
    const result = await collect(of(1, 2, 3).filter(() => false))
    expect(result).toEqual([])
  })
})

describe('take', () => {
  it('emits first n values', async () => {
    const result = await collect(of(1, 2, 3, 4, 5).take(3))
    expect(result).toEqual([1, 2, 3])
  })

  it('handles take larger than source', async () => {
    const result = await collect(of(1, 2).take(10))
    expect(result).toEqual([1, 2])
  })

  it('throws on invalid n', () => {
    const [read] = channel()
    expect(() => read.take(0)).toThrow()
    expect(() => read.take(-1)).toThrow()
    expect(() => read.take('a')).toThrow()
  })
})

describe('scan', () => {
  it('accumulates and emits intermediates', async () => {
    const result = await collect(of(1, 2, 3).scan((acc, v) => acc + v, 0))
    expect(result).toEqual([1, 3, 6])
  })

  it('works with object accumulation', async () => {
    const result = await collect(of({ a: 1 }, { b: 2 }).scan((acc, v) => ({ ...acc, ...v }), {}))
    expect(result).toEqual([{ a: 1 }, { a: 1, b: 2 }])
  })
})

describe('tee', () => {
  it('splits into independent readers', async () => {
    const [a, b] = of(1, 2, 3).tee(2)
    const [ra, rb] = await Promise.all([collect(a), collect(b)])
    expect(ra).toEqual([1, 2, 3])
    expect(rb).toEqual([1, 2, 3])
  })

  it('supports more than 2 branches', async () => {
    const branches = of(1, 2).tee(4)
    const results = await Promise.all(branches.map(collect))
    results.forEach(r => expect(r).toEqual([1, 2]))
  })
})

describe('merge', () => {
  it('combines multiple readers', async () => {
    const a = of(1, 2)
    const b = of(3, 4)
    const result = await collect(merge([a, b]))
    expect(result).toHaveLength(4)
    expect(result.sort()).toEqual([1, 2, 3, 4])
  })

  it('closes only when all sources close', async () => {
    const [readA, writeA] = channel()
    const [readB, writeB] = channel()

    const collecting = collect(merge([readA, readB]))

    writeA.send(1)
    writeA.close()
    // merge should NOT close yet
    await Promise.resolve()
    writeB.send(2)
    writeB.close()

    const result = await collecting
    expect(result.sort()).toEqual([1, 2])
  })
})

describe('tap', () => {
  it('runs side effect without changing values', async () => {
    const seen = []
    const result = await collect(of(1, 2, 3).tap(v => seen.push(v)))
    expect(result).toEqual([1, 2, 3])
    expect(seen).toEqual([1, 2, 3])
  })
})

describe('thru', () => {
  it('passes reader to user-defined combinator', async () => {
    const double = reader => reader.map(v => v * 2)
    const result = await collect(of(1, 2, 3).thru(double))
    expect(result).toEqual([2, 4, 6])
  })
})

describe('combinator chains', () => {
  it('map -> filter -> take -> sink', async () => {
    const result = await collect(
      of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
        .map(v => v * 2)
        .filter(v => v > 6)
        .take(3)
    )
    expect(result).toEqual([8, 10, 12])
  })

  it('message pipeline: map(update) -> filter -> sink', async () => {
    const result = await collect(
      of({ temp: 72 }, { temp: 65 }, { temp: 80 })
        .map(update(m => ({ hot: m.temp > 70 })))
        .filter(m => m.hot)
    )
    expect(result).toEqual([
      { temp: 72, hot: true },
      { temp: 80, hot: true },
    ])
  })
})

describe('partial information', () => {
  it('scan builds local understanding from message fragments', async () => {
    const result = await collect(
      of({ temperature: 72 }, { humidity: 45 }, { temperature: 68 }).scan((state, msg) => ({ ...state, ...msg }), {})
    )
    expect(result).toEqual([{ temperature: 72 }, { temperature: 72, humidity: 45 }, { temperature: 68, humidity: 45 }])
  })
})

describe('live channels', () => {
  it('map transforms values arriving over time', async () => {
    const [read, write] = channel()
    const mapped = read.map(v => v * 2)
    const collecting = collect(mapped)

    await Promise.resolve()
    write.send(1)
    await Promise.resolve()
    write.send(2)
    await Promise.resolve()
    write.send(3)
    write.close()

    expect(await collecting).toEqual([2, 4, 6])
  })

  it('filter with async producer', async () => {
    const [read, write] = channel()
    const filtered = read.filter(v => v % 2 === 0)
    const collecting = collect(filtered)

    await Promise.resolve()
    write.send(1)
    write.send(2)
    write.send(3)
    write.send(4)
    write.close()

    expect(await collecting).toEqual([2, 4])
  })

  it('scan accumulates from a live source', async () => {
    const [read, write] = channel()
    const accumulated = read.scan((acc, v) => acc + v, 0)
    const collecting = collect(accumulated)

    await Promise.resolve()
    write.send(10)
    await Promise.resolve()
    write.send(20)
    await Promise.resolve()
    write.send(5)
    write.close()

    expect(await collecting).toEqual([10, 30, 35])
  })

  it('chained pipeline with live producer', async () => {
    const [read, write] = channel()
    const pipeline = read
      .map(v => v * 2)
      .filter(v => v > 4)
      .take(2)
    const collecting = collect(pipeline)

    await Promise.resolve()
    write.send(1) // *2=2, filtered out
    write.send(2) // *2=4, filtered out
    write.send(3) // *2=6, passes, taken (1/2)
    write.send(4) // *2=8, passes, taken (2/2), done
    write.send(5) // never consumed

    expect(await collecting).toEqual([6, 8])
  })
})

describe('error propagation', () => {
  it('error propagates through map', async () => {
    const [read, write] = channel()
    const mapped = read.map(v => v * 2)

    const collecting = collect(mapped)
    write.err(new Error('source failed'))

    await expect(collecting).rejects.toThrow('source failed')
  })

  it('error propagates through filter', async () => {
    const [read, write] = channel()
    const filtered = read.filter(v => v > 0)

    const collecting = collect(filtered)
    write.err(new Error('source failed'))

    await expect(collecting).rejects.toThrow('source failed')
  })

  it('error propagates through chained combinators', async () => {
    const [read, write] = channel()
    const pipeline = read
      .map(v => v)
      .filter(v => v)
      .take(10)

    const collecting = collect(pipeline)
    write.err(new Error('deep failure'))

    await expect(collecting).rejects.toThrow('deep failure')
  })

  it('map function throw propagates downstream', async () => {
    const [read, write] = channel()
    const mapped = read.map(() => {
      throw new Error('transform broke')
    })
    const collecting = collect(mapped)

    write.send(1)

    await expect(collecting).rejects.toThrow('transform broke')
  })

  it('filter predicate throw propagates downstream', async () => {
    const [read, write] = channel()
    const filtered = read.filter(() => {
      throw new Error('predicate broke')
    })
    const collecting = collect(filtered)

    write.send(1)

    await expect(collecting).rejects.toThrow('predicate broke')
  })

  it('scan accumulator throw propagates downstream', async () => {
    const [read, write] = channel()
    const scanned = read.scan(() => {
      throw new Error('accumulator broke')
    }, 0)
    const collecting = collect(scanned)

    write.send(1)

    await expect(collecting).rejects.toThrow('accumulator broke')
  })
})
