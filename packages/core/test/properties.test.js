import { test, expect } from 'vitest'
import { fc, it } from '@fast-check/vitest'
import { message, update, isEmpty } from '../src/messages.js'
import { channel, slidingChannel, merge, ConsumedChannelError } from '../src/channel.js'

async function collect(reader) {
  const values = []
  await reader.sink(v => values.push(v))
  return values
}

// build plain objects via fromEntries to avoid __proto__ prototype poisoning
const plainObject = fc
  .array(fc.tuple(fc.string(), fc.jsonValue()), { maxLength: 10 })
  .map(pairs => Object.fromEntries(pairs))

// --- message properties ---

it.prop([fc.anything()])('message always returns a plain object', input => {
  const msg = message(input)
  expect(Object.getPrototypeOf(msg)).toBe(Object.prototype)
})

it.prop([plainObject])('message of plain object is a copy, not same reference', obj => {
  const msg = message(obj)
  expect(msg).toEqual(obj)
  expect(msg).not.toBe(obj)
})

it.prop([plainObject])('message idempotence — normalizing twice equals normalizing once', obj => {
  const once = message(obj)
  const twice = message(once)
  expect(twice).toEqual(once)
})

it.prop([plainObject])('isEmpty matches Object.keys length', obj => {
  expect(isEmpty(obj)).toBe(Object.keys(obj).length === 0)
})

// --- update properties ---

it.prop([plainObject])('update curried and direct forms are equivalent', obj => {
  const fn = () => ({ tagged: true })
  expect(update(obj, fn)).toEqual(update(fn)(obj))
})

// generate arbitrary update functions that return plain objects with random keys
const updateFn = fc.array(fc.tuple(fc.string(), fc.jsonValue()), { maxLength: 5 }).map(pairs => {
  const result = Object.fromEntries(pairs)
  return () => result
})

it.prop([plainObject, updateFn])('update curried and direct forms equivalent with arbitrary fns', (obj, fn) => {
  expect(update(obj, fn)).toEqual(update(fn)(obj))
})

it.prop([plainObject])('update with fn returning undefined is a copy', obj => {
  // fn returns undefined → spread of undefined is no-op
  const result = update(obj, () => undefined)
  expect(result).toEqual(obj)
})

it.prop([plainObject, updateFn])('update result contains all original keys plus fn keys', (obj, fn) => {
  const result = update(obj, fn)
  const fnResult = fn(obj)
  for (const key of Object.keys(obj)) expect(result).toHaveProperty(key)
  if (fnResult && typeof fnResult === 'object') {
    for (const key of Object.keys(fnResult)) expect(result).toHaveProperty(key)
  }
})

// --- channel order preservation with fc.anything() ---

it.prop([fc.array(fc.anything(), { minLength: 0, maxLength: 50 })])(
  'channel preserves order for any values',
  async values => {
    const [read, write] = channel()
    values.forEach(v => write.send(v))
    write.close()
    const result = await collect(read)
    expect(result.length).toBe(values.length)
    // use Object.is for each element to handle NaN, -0, etc.
    for (let i = 0; i < values.length; i++) {
      expect(Object.is(result[i], values[i])).toBe(true)
    }
  }
)

// --- channel handles exotic values ---

test('channel handles exotic values without dropping or coercing', async () => {
  const exotics = [undefined, null, 0, false, '', NaN, -0, Infinity]
  const [read, write] = channel()
  exotics.forEach(v => write.send(v))
  write.close()
  const result = await collect(read)
  expect(result.length).toBe(exotics.length)
  for (let i = 0; i < exotics.length; i++) {
    expect(Object.is(result[i], exotics[i])).toBe(true)
  }
})

// --- take exact count ---

it.prop([fc.array(fc.anything(), { minLength: 1, maxLength: 50 }), fc.integer({ min: 1, max: 50 })])(
  'take returns exactly min(n, values.length) values',
  async (values, n) => {
    const [read, write] = channel()
    values.forEach(v => write.send(v))
    write.close()
    const result = await collect(read.take(n))
    expect(result.length).toBe(Math.min(n, values.length))
  }
)

// --- filter preserves relative order (subsequence check) ---

it.prop([fc.array(fc.integer(), { minLength: 0, maxLength: 50 })])(
  'filter preserves relative order — output is a subsequence of input',
  async values => {
    const pred = v => v > 0
    const [read, write] = channel()
    values.forEach(v => write.send(v))
    write.close()
    const result = await collect(read.filter(pred))
    // every element satisfies predicate
    result.forEach(v => expect(pred(v)).toBe(true))
    // result matches reference filter (exact same elements in same order)
    expect(result).toEqual(values.filter(pred))
    // subsequence check: each result element appears in input in order
    let idx = 0
    for (const v of result) {
      while (idx < values.length && values[idx] !== v) idx++
      expect(idx).toBeLessThan(values.length)
      idx++
    }
  }
)

// --- map functor law ---

it.prop([fc.array(fc.integer(), { minLength: 0, maxLength: 30 })])(
  'map functor law — map(f).map(g) equals map(x => g(f(x)))',
  async values => {
    const f = x => x + 1
    const g = x => x * 2

    const [read1, write1] = channel()
    values.forEach(v => write1.send(v))
    write1.close()
    const composed = await collect(read1.map(f).map(g))

    const [read2, write2] = channel()
    values.forEach(v => write2.send(v))
    write2.close()
    const fused = await collect(read2.map(x => g(f(x))))

    expect(composed).toEqual(fused)
  }
)

// --- tee produces identical copies ---

it.prop([fc.array(fc.anything(), { minLength: 0, maxLength: 30 }), fc.integer({ min: 2, max: 5 })])(
  'tee(n) produces n readers with identical values',
  async (values, n) => {
    const [read, write] = channel()
    values.forEach(v => write.send(v))
    write.close()
    const readers = read.tee(n)
    expect(readers.length).toBe(n)
    const results = await Promise.all(readers.map(r => collect(r)))
    for (const result of results) {
      expect(result.length).toBe(values.length)
      for (let i = 0; i < values.length; i++) {
        expect(Object.is(result[i], values[i])).toBe(true)
      }
    }
  }
)

// --- sliding channel keeps last N ---

it.prop([fc.array(fc.integer(), { minLength: 0, maxLength: 50 }), fc.integer({ min: 1, max: 20 })])(
  'sliding channel keeps exactly the last size values',
  async (values, size) => {
    const [read, write] = slidingChannel(size)
    values.forEach(v => write.send(v))
    write.close()
    const result = await collect(read)
    expect(result).toEqual(values.slice(-size))
  }
)

// empty input special case
test('sliding channel with no values returns empty', async () => {
  const [read, write] = slidingChannel(3)
  write.close()
  expect(await collect(read)).toEqual([])
})

// --- scan reference check (prefix sums) ---

it.prop([fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 0, maxLength: 50 })])(
  'scan with addition matches reference prefix-sum',
  async values => {
    const [read, write] = channel()
    values.forEach(v => write.send(v))
    write.close()
    const result = await collect(read.scan((a, v) => a + v, 0))
    // compute reference prefix sums
    const expected = []
    let sum = 0
    for (const v of values) {
      sum += v
      expected.push(sum)
    }
    expect(result).toEqual(expected)
  }
)

// --- merge contains all values ---

it.prop([fc.array(fc.array(fc.integer(), { minLength: 0, maxLength: 20 }), { minLength: 1, maxLength: 5 })])(
  'merge of multiple channels contains exactly the union of all inputs',
  async arrays => {
    const pairs = arrays.map(() => channel())
    arrays.forEach((values, i) => {
      values.forEach(v => pairs[i][1].send(v))
      pairs[i][1].close()
    })
    const readers = pairs.map(([read]) => read)
    const merged = merge(readers)
    const result = await collect(merged)
    const allValues = arrays.flat()
    // same elements (order between sources not guaranteed)
    expect(result.sort()).toEqual(allValues.sort())
  }
)

// --- map preserves length ---

it.prop([fc.array(fc.integer(), { minLength: 0, maxLength: 50 })])('map preserves length', async values => {
  const [read, write] = channel()
  values.forEach(v => write.send(v))
  write.close()
  const result = await collect(read.map(v => v * 2))
  expect(result.length).toBe(values.length)
})

// --- map identity law ---

it.prop([fc.array(fc.anything(), { minLength: 0, maxLength: 30 })])(
  'map with identity function is identity',
  async values => {
    const [read, write] = channel()
    values.forEach(v => write.send(v))
    write.close()
    const result = await collect(read.map(x => x))
    expect(result.length).toBe(values.length)
    for (let i = 0; i < values.length; i++) {
      expect(Object.is(result[i], values[i])).toBe(true)
    }
  }
)

// --- filter identity and annihilation ---

it.prop([fc.array(fc.anything(), { minLength: 0, maxLength: 30 })])(
  'filter with always-true predicate is identity',
  async values => {
    const [read, write] = channel()
    values.forEach(v => write.send(v))
    write.close()
    const result = await collect(read.filter(() => true))
    expect(result.length).toBe(values.length)
    for (let i = 0; i < values.length; i++) {
      expect(Object.is(result[i], values[i])).toBe(true)
    }
  }
)

it.prop([fc.array(fc.anything(), { minLength: 0, maxLength: 30 })])(
  'filter with always-false predicate returns empty',
  async values => {
    const [read, write] = channel()
    values.forEach(v => write.send(v))
    write.close()
    const result = await collect(read.filter(() => false))
    expect(result).toEqual([])
  }
)

// --- write after close is silently dropped ---

it.prop([
  fc.array(fc.integer(), { minLength: 0, maxLength: 30 }),
  fc.array(fc.integer(), { minLength: 1, maxLength: 30 }),
])('values written after close are silently dropped', async (before, after) => {
  const [read, write] = channel()
  before.forEach(v => write.send(v))
  write.close()
  after.forEach(v => write.send(v))
  const result = await collect(read)
  expect(result).toEqual(before)
})

// --- close is idempotent ---

it.prop([fc.array(fc.integer(), { minLength: 0, maxLength: 20 })])(
  'close is idempotent — calling it multiple times is safe',
  async values => {
    const [read, write] = channel()
    values.forEach(v => write.send(v))
    write.close()
    write.close()
    write.close()
    const result = await collect(read)
    expect(result).toEqual(values)
  }
)

// --- err with queued values delivers queue before error ---

it.prop([fc.array(fc.integer(), { minLength: 1, maxLength: 30 })])(
  'err with queued values delivers queue before error',
  async values => {
    const [read, write] = channel()
    values.forEach(v => write.send(v))
    const sentinel = new Error('test error')
    write.err(sentinel)
    const collected = []
    let caughtError = null
    try {
      await read.sink(v => collected.push(v))
    } catch (e) {
      caughtError = e
    }
    expect(collected).toEqual(values)
    expect(caughtError).toBe(sentinel)
  }
)

// --- err with empty queue rejects immediately ---

test('err with no queued values rejects immediately', async () => {
  const [read, write] = channel()
  const sentinel = new Error('immediate')
  write.err(sentinel)
  let caughtError = null
  try {
    await read.sink(() => {})
  } catch (e) {
    caughtError = e
  }
  expect(caughtError).toBe(sentinel)
})

// --- double consumption throws ConsumedChannelError ---

test('consuming a reader twice throws ConsumedChannelError', async () => {
  const [read, write] = channel()
  write.send(1)
  write.close()
  // first consumption (via map) should succeed
  const result = await collect(read.map(x => x))
  expect(result).toEqual([1])
  // second consumption should propagate ConsumedChannelError
  let caughtError = null
  try {
    await collect(read.filter(() => true))
  } catch (e) {
    caughtError = e
  }
  expect(caughtError).toBeInstanceOf(ConsumedChannelError)
})

// --- send with multiple args ---

it.prop([fc.array(fc.array(fc.integer(), { minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 10 })])(
  'send with multiple args delivers all values in order',
  async batches => {
    const [read, write] = channel()
    batches.forEach(batch => write.send(...batch))
    write.close()
    const result = await collect(read)
    expect(result).toEqual(batches.flat())
  }
)

// --- tee + take on one branch does not affect other branches ---

it.prop([fc.array(fc.integer(), { minLength: 2, maxLength: 30 }), fc.integer({ min: 1, max: 29 })])(
  'take on one tee branch does not starve the other',
  async (values, k) => {
    const takeN = Math.min(k, values.length - 1) // ensure take < values.length
    const [read, write] = channel()
    values.forEach(v => write.send(v))
    write.close()
    const [branch1, branch2] = read.tee(2)
    const [taken, full] = await Promise.all([collect(branch1.take(takeN)), collect(branch2)])
    expect(taken.length).toBe(takeN)
    expect(taken).toEqual(values.slice(0, takeN))
    expect(full).toEqual(values)
  }
)

// --- combinator composition: filter-then-take vs take-then-filter ---

it.prop([fc.array(fc.integer(), { minLength: 0, maxLength: 40 }), fc.integer({ min: 1, max: 20 })])(
  'filter-then-take produces a prefix of the filtered array',
  async (values, n) => {
    const pred = v => v > 0
    const [read, write] = channel()
    values.forEach(v => write.send(v))
    write.close()
    const result = await collect(read.filter(pred).take(n))
    const reference = values.filter(pred).slice(0, n)
    expect(result).toEqual(reference)
  }
)

it.prop([fc.array(fc.integer(), { minLength: 0, maxLength: 40 }), fc.integer({ min: 1, max: 20 })])(
  'take-then-filter produces filtered prefix — different from filter-then-take',
  async (values, n) => {
    const pred = v => v > 0
    const [read, write] = channel()
    values.forEach(v => write.send(v))
    write.close()
    const result = await collect(read.take(n).filter(pred))
    const reference = values.slice(0, n).filter(pred)
    expect(result).toEqual(reference)
  }
)

// --- sliding channel with size >= input keeps everything ---

it.prop([fc.array(fc.integer(), { minLength: 0, maxLength: 20 }), fc.integer({ min: 1, max: 50 })])(
  'sliding channel with size > input length keeps all values',
  async (values, extra) => {
    const size = values.length + extra
    const [read, write] = slidingChannel(size)
    values.forEach(v => write.send(v))
    write.close()
    const result = await collect(read)
    expect(result).toEqual(values)
  }
)

// --- merge edge cases ---

test('merge of empty readers array returns empty', async () => {
  const merged = merge([])
  expect(await collect(merged)).toEqual([])
})

it.prop([fc.array(fc.integer(), { minLength: 0, maxLength: 30 })])(
  'merge of single channel is identity',
  async values => {
    const [read, write] = channel()
    values.forEach(v => write.send(v))
    write.close()
    const result = await collect(merge([read]))
    expect(result).toEqual(values)
  }
)

// --- empty channel ---

test('closing immediately yields empty collection', async () => {
  const [read, write] = channel()
  write.close()
  expect(await collect(read)).toEqual([])
})

// --- scan with discard-accumulator is equivalent to map ---

it.prop([fc.array(fc.integer(), { minLength: 0, maxLength: 30 })])(
  'scan that ignores accumulator behaves like map',
  async values => {
    const fn = v => v * 10
    const [read1, write1] = channel()
    values.forEach(v => write1.send(v))
    write1.close()
    const scanResult = await collect(read1.scan((_, v) => fn(v), null))

    const [read2, write2] = channel()
    values.forEach(v => write2.send(v))
    write2.close()
    const mapResult = await collect(read2.map(fn))

    expect(scanResult).toEqual(mapResult)
  }
)
