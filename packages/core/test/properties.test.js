import { test, expect } from 'vitest'
import { fc, it } from '@fast-check/vitest'
import { message, port, consume, is, cell } from '../src/bassline.js'

async function collect(recv) {
  const c = cell((current, incoming, update) => update([...current, incoming]), [])
  const prop = consume(recv, c.send)
  await prop.promise
  return c.value()
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

// --- port order preservation ---

it.prop([fc.array(fc.anything(), { minLength: 0, maxLength: 50 })])(
  'port preserves order for any values',
  async values => {
    const p = port()
    for (const v of values) {
      if (is.eof(v)) continue
      p.send(v)
    }
    p.close()
    const result = await collect(p.recv)
    const expected = values.filter(v => !is.eof(v))
    expect(result.length).toBe(expected.length)
    for (let i = 0; i < expected.length; i++) {
      expect(Object.is(result[i], expected[i])).toBe(true)
    }
  }
)

// --- port handles exotic values ---

test('port handles exotic values without dropping or coercing', async () => {
  const exotics = [undefined, null, 0, false, '', NaN, -0, Infinity]
  const p = port()
  exotics.forEach(v => p.send(v))
  p.close()
  const result = await collect(p.recv)
  expect(result.length).toBe(exotics.length)
  for (let i = 0; i < exotics.length; i++) {
    expect(Object.is(result[i], exotics[i])).toBe(true)
  }
})

// --- send after close is silently dropped ---

it.prop([
  fc.array(fc.integer(), { minLength: 0, maxLength: 30 }),
  fc.array(fc.integer(), { minLength: 1, maxLength: 30 }),
])('values sent after close are silently dropped', async (before, after) => {
  const p = port()
  before.forEach(v => p.send(v))
  p.close()
  after.forEach(v => p.send(v))
  const result = await collect(p.recv)
  expect(result).toEqual(before)
})

// --- close is idempotent ---

it.prop([fc.array(fc.integer(), { minLength: 0, maxLength: 20 })])(
  'close is idempotent — calling it multiple times is safe',
  async values => {
    const p = port()
    values.forEach(v => p.send(v))
    p.close()
    p.close()
    p.close()
    const result = await collect(p.recv)
    expect(result).toEqual(values)
  }
)

// --- sliding port keeps last N ---

it.prop([fc.array(fc.integer(), { minLength: 0, maxLength: 50 }), fc.integer({ min: 1, max: 20 })])(
  'sliding port keeps exactly the last size values',
  async (values, size) => {
    const p = port(size)
    values.forEach(v => p.send(v))
    p.close()
    const result = await collect(p.recv)
    expect(result).toEqual(values.slice(-size))
  }
)

test('sliding port with no values returns empty', async () => {
  const p = port(3)
  p.close()
  expect(await collect(p.recv)).toEqual([])
})

// --- sliding port with size >= input keeps everything ---

it.prop([fc.array(fc.integer(), { minLength: 0, maxLength: 20 }), fc.integer({ min: 1, max: 50 })])(
  'sliding port with size > input length keeps all values',
  async (values, extra) => {
    const size = values.length + extra
    const p = port(size)
    values.forEach(v => p.send(v))
    p.close()
    const result = await collect(p.recv)
    expect(result).toEqual(values)
  }
)

// --- empty port ---

test('closing immediately yields empty collection', async () => {
  const p = port()
  p.close()
  expect(await collect(p.recv)).toEqual([])
})
