import { test, expect } from 'vitest'
import { fc, it } from '@fast-check/vitest'
import { message, port, net } from '../src/bassline.js'
import { collect, filledPort } from './utils.js'

const plainObject = fc
  .array(fc.tuple(fc.string(), fc.jsonValue()), { maxLength: 10 })
  .map(pairs => Object.fromEntries(pairs))

it.prop([fc.anything()])('message always returns a plain object', input => {
  const msg = message(input)
  expect(Object.getPrototypeOf(msg)).toBe(Object.prototype)
})

it.prop([plainObject])(
  'message of plain object is a copy, not same reference',
  obj => {
    const msg = message(obj)
    expect(msg).toEqual(obj)
    expect(msg).not.toBe(obj)
  }
)

it.prop([plainObject, fc.integer({ min: 5, max: 20 })])(
  'message is idempotent',
  (obj, n) => {
    let res = message(obj)
    for (let i = 0; i < n; i++) {
      res = message(res)
    }
    expect(res).toEqual(obj)
  }
)

it.prop([fc.array(fc.anything(), { minLength: 0, maxLength: 50 })])(
  'port preserves order for any values',
  async values => {
    const p = filledPort(values)
    const result = await collect(p.recv)
    expect(result.length).toBe(values.length)
    expect(values).toEqual(result)
  }
)

// --- send after close is silently dropped ---

it.prop([
  fc.array(fc.anything(), { minLength: 0, maxLength: 30 }),
  fc.array(fc.anything(), { minLength: 0, maxLength: 30 }),
])('values sent after close are silently dropped', async (before, after) => {
  const p = port()
  before.forEach(v => p.send(v))
  p.close()
  after.forEach(v => p.send(v))
  const result = await collect(p.recv)
  expect(result).toEqual(before)
})

it.prop([
  fc.array(fc.anything(), { minLength: 0, maxLength: 20 }),
  fc.integer({ min: 5, max: 20 }),
])(
  'close is idempotent — calling it multiple times is safe',
  async (values, n) => {
    const p = port()
    values.forEach(v => p.send(v))
    for (let i = 0; i < n; i++) p.close()
    const result = await collect(p.recv)
    expect(result).toEqual(values)
  }
)

it.prop([
  fc.array(fc.integer(), { minLength: 0, maxLength: 50 }),
  fc.integer({ min: 1, max: 20 }),
])('sliding port keeps exactly the last size values', async (values, size) => {
  const p = port(size)
  values.forEach(v => p.send(v))
  p.close()
  const result = await collect(p.recv)
  expect(result).toEqual(values.slice(-size))
})

test('sliding port with no values returns empty', async () => {
  const p = port(3)
  p.close()
  expect(await collect(p.recv)).toEqual([])
})

// --- sliding port with size >= input keeps everything ---

it.prop([
  fc.array(fc.integer(), { minLength: 0, maxLength: 20 }),
  fc.integer({ min: 1, max: 50 }),
])(
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

test('closing immediately yields empty collection', async () => {
  const p = port()
  p.close()
  expect(await collect(p.recv)).toEqual([])
})

// --- net properties ---

it.prop([fc.array(fc.anything(), { minLength: 1, maxLength: 20 })])(
  'net: every participant receives what others send',
  async values => {
    const { join, close } = net()
    const sender = join()
    const a = join()
    const b = join()

    values.forEach(v => sender.send(v))
    close()

    const ra = await collect(a.recv)
    const rb = await collect(b.recv)
    expect(ra).toEqual(values)
    expect(rb).toEqual(values)
  }
)

it.prop([fc.array(fc.anything(), { minLength: 1, maxLength: 20 })])(
  'net: sender never receives own messages',
  async values => {
    const { join, close } = net()
    const a = join()
    const b = join()

    values.forEach(v => a.send(v))
    close()

    // a only sees what b sent (nothing)
    expect(await collect(a.recv)).toEqual([])
    expect(await collect(b.recv)).toEqual(values)
  }
)

it.prop([
  fc.array(fc.anything(), { minLength: 0, maxLength: 10 }),
  fc.array(fc.anything(), { minLength: 0, maxLength: 10 }),
])('net: join.send broadcasts to all participants', async (before, after) => {
  const { join, send, close } = net()
  const a = join()
  const b = join()

  before.forEach(v => send(v))
  after.forEach(v => send(v))
  close()

  const all = [...before, ...after]
  expect(await collect(a.recv)).toEqual(all)
  expect(await collect(b.recv)).toEqual(all)
})

// --- net.close ---

it.prop([fc.array(fc.anything(), { minLength: 1, maxLength: 20 })])(
  'net: join.close produces EOF on all participants',
  async values => {
    const { join, close } = net()
    const a = join()
    const b = join()

    values.forEach(v => a.send(v))
    close()

    expect(await collect(a.recv)).toEqual([])
    expect(await collect(b.recv)).toEqual(values)
  }
)

it.prop([
  fc.array(fc.anything(), { minLength: 0, maxLength: 10 }),
  fc.array(fc.anything(), { minLength: 0, maxLength: 10 }),
])(
  'net: sends after participant close are not routed to it',
  async (before, after) => {
    const { join } = net()
    const a = join()
    const b = join()
    const c = join()

    before.forEach(v => a.send(v))
    b.close()
    after.forEach(v => a.send(v))
    c.close()

    // b only got messages before its close
    expect(await collect(b.recv)).toEqual(before)
    // c got everything
    expect(await collect(c.recv)).toEqual([...before, ...after])
    a.close()
  }
)
