import { fc, test } from '@fast-check/vitest'
import { expect } from 'vitest'
import { Msg, msg, port, net } from '../src/bassline.js'
import { collect, filledPort } from './utils.js'

const defined = fc.anything().filter(v => v !== undefined)

test.prop([fc.dictionary(fc.string(), fc.anything())])(
  'message always returns a message',
  input => {
    const m = msg().merge(input)
    expect(m).toBeInstanceOf(Msg)
  }
)

test.prop([fc.object()])(
  'message of plain object is a copy, not same reference',
  obj => {
    const m = msg().merge(obj)
    expect(m.data).toEqual(obj)
    expect(m.data).not.toBe(obj)
  }
)

test.prop([fc.object(), fc.integer({ min: 5, max: 20 })])(
  'message is idempotent',
  (obj, n) => {
    const init = msg().merge(obj)
    let res = msg().merge(init)
    for (let i = 0; i < n; i++) {
      res = msg().merge(res)
    }
    expect(res.data).toEqual(init.data)
    expect(res.caps).toEqual(init.caps)
  }
)

test.prop([fc.array(defined, { minLength: 0, maxLength: 50 })])(
  'port preserves order for invocations',
  async values => {
    const [, recv] = filledPort(values)
    const result = await collect(recv)
    expect(result.length).toBe(values.length)
    expect(values).toEqual(result)
  }
)

test.prop([
  fc.array(defined, { minLength: 0, maxLength: 30 }),
  fc.array(defined, { minLength: 0, maxLength: 30 }),
])('values sent after close are silently dropped', async (before, after) => {
  const [p, recv] = port()
  before.forEach(v => p.send(v))
  p.close()
  after.forEach(v => p.send(v))
  const result = await collect(recv)
  expect(result).toEqual(before)
})

test.prop([
  fc.array(defined, { minLength: 0, maxLength: 20 }),
  fc.integer({ min: 5, max: 20 }),
])(
  'close is idempotent — calling it multiple times is safe',
  async (values, n) => {
    const [p, recv] = port()
    values.forEach(v => p.send(v))
    for (let i = 0; i < n; i++) p.close()
    const result = await collect(recv)
    expect(result).toEqual(values)
  }
)

test.prop([
  fc.array(defined, { minLength: 0, maxLength: 50 }),
  fc.integer({ min: 1, max: 20 }),
])('sliding port keeps exactly the last size values', async (values, size) => {
  const [p, recv] = port(size)
  values.forEach(v => p.send(v))
  p.close()
  const result = await collect(recv)
  expect(result).toEqual(values.slice(-size))
})

test('sliding port with no values returns empty', async () => {
  const [p, recv] = port(3)
  p.close()
  expect(await collect(recv)).toEqual([])
})

test('closing immediately yields empty collection', async () => {
  const [p, recv] = port()
  p.close()
  expect(await collect(recv)).toEqual([])
})

// --- sliding port with size >= input keeps everything ---

test.prop([
  fc.array(defined, { minLength: 0, maxLength: 20 }),
  fc.integer({ min: 1, max: 50 }),
])(
  'sliding port with size > input length keeps all values',
  async (values, extra) => {
    const size = values.length + extra
    const [p, recv] = port(size)
    values.forEach(v => p.send(v))
    p.close()
    const result = await collect(recv)
    expect(result).toEqual(values)
  }
)

// --- net properties ---

test.prop([fc.array(defined, { minLength: 1, maxLength: 20 })])(
  'net: every participant receives what others send',
  async values => {
    const [n, join] = net()
    const [sender] = join()
    const [, recva] = join()
    const [, recvb] = join()

    values.forEach(v => sender.send(v))
    n.close()

    const ra = await collect(recva)
    const rb = await collect(recvb)
    expect(ra).toEqual(values)
    expect(rb).toEqual(values)
  }
)

test.prop([fc.array(defined, { minLength: 1, maxLength: 20 })])(
  'net: sender never receives own messages',
  async values => {
    const [n, join] = net()
    const [a, recva] = join()
    const [_b, recvb] = join()

    values.forEach(v => a.send(v))
    n.close()

    // a only sees what b sent (nothing)
    expect(await collect(recva)).toEqual([])
    expect(await collect(recvb)).toEqual(values)
  }
)

test.prop([
  fc.array(defined, { minLength: 0, maxLength: 10 }),
  fc.array(defined, { minLength: 0, maxLength: 10 }),
])('net: join.send broadcasts to all participants', async (before, after) => {
  const [n, join] = net()
  const [, recva] = join()
  const [, recvb] = join()

  before.forEach(v => n.send(v))
  after.forEach(v => n.send(v))
  n.close()

  const all = [...before, ...after]
  expect(await collect(recva)).toEqual(all)
  expect(await collect(recvb)).toEqual(all)
})

// --- net.close ---

test.prop([fc.array(defined, { minLength: 1, maxLength: 20 })])(
  'net: join.close produces EOF on all participants',
  async values => {
    const [n, join] = net()
    const [a, recva] = join()
    const [_b, recvb] = join()

    values.forEach(v => a.send(v))
    n.close()

    expect(await collect(recva)).toEqual([])
    expect(await collect(recvb)).toEqual(values)
  }
)

test.prop([
  fc.array(defined, { minLength: 0, maxLength: 10 }),
  fc.array(defined, { minLength: 0, maxLength: 10 }),
])(
  'net: sends after participant close are not routed to it',
  async (before, after) => {
    const [_, join] = net()
    const [a] = join()
    const [b, recvb] = join()
    const [c, recvc] = join()

    before.forEach(v => a.send(v))
    b.close()
    after.forEach(v => a.send(v))
    c.close()

    // b only got messages before its close
    expect(await collect(recvb)).toEqual(before)
    // c got everything
    expect(await collect(recvc)).toEqual([...before, ...after])
    a.close()
  }
)
