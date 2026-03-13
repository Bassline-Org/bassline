import { describe, it, expect, afterEach } from 'vitest'
import { Platform } from '../src/kernel/platform.js'
import { reducers, scope } from '../src/resources/index.js'
import link from '../src/link/runtime.js'
import client from '../src/link/client.js'
import wsPlatform from '../src/platforms/ws.js'

function setup() {
  const p = new Platform()
  p.use(reducers, scope, link, client, wsPlatform)
  return p
}

function wait(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

let cleanups = []
afterEach(async () => {
  for (const fn of cleanups.reverse()) await fn()
  cleanups = []
})

function trackClose(closeFn) {
  let done = false
  const wrapped = async () => {
    if (done) return
    done = true
    await closeFn()
  }
  cleanups.push(wrapped)
  return wrapped
}

describe('ManagedConnection over WebSocket', () => {
  it('connects and sends messages through ws links', async () => {
    const p = setup()
    const localScope = p.create.Scope()
    localScope({ put: p.create.Slot({ value: 42 }), at: 'counter' })

    const server = p.ws.serve({ port: 9310, localScope })
    const closeServer = trackClose(server.close)

    let connectCount = 0
    const conn = new p.client.ManagedConnection({
      connect: async () => {
        connectCount += 1
        return p.ws.connect({ url: 'ws://localhost:9310' })
      },
    })
    const closeConn = trackClose(() => conn.close())

    const counter = await conn.send({ at: 'counter' })
    expect(await counter({})).toBe(42)
    expect(connectCount).toBe(1)

    await closeConn()
    await closeServer()
  })

  it('fails in-flight on server drop and reconnects on next send', async () => {
    const p = setup()
    const R = p.classes.Resource
    const localScope = p.resource(new (class extends R {
      get(msg = {}) {
        if (msg.type === 'slow') return new Promise(() => {})
        return 'ok'
      }
    })())

    let server = p.ws.serve({ port: 9311, localScope })
    const closeServer = trackClose(() => server.close())

    let connectCount = 0
    const conn = new p.client.ManagedConnection({
      connect: async () => {
        connectCount += 1
        return p.ws.connect({ url: 'ws://localhost:9311' })
      },
    })
    const closeConn = trackClose(() => conn.close())

    const pending = conn.send({ type: 'slow' })
    await wait(10)
    await closeServer()
    await expect(pending).rejects.toMatchObject({ code: 'E_CLOSED' })

    server = p.ws.serve({ port: 9311, localScope })
    const closeServer2 = trackClose(() => server.close())
    expect(await conn.send({ type: 'ok' })).toBe('ok')
    expect(connectCount).toBe(2)

    await closeConn()
    await closeServer2()
  })

  it('handles heartbeat failure and recovers on subsequent sends', async () => {
    const p = setup()
    const R = p.classes.Resource
    const localScope = p.resource(new (class extends R {
      get(msg = {}) {
        if (msg.type === 'probe') return new Promise(() => {})
        return 'ok'
      }
    })())

    const server = p.ws.serve({ port: 9312, localScope })
    const closeServer = trackClose(server.close)

    let connectCount = 0
    const conn = new p.client.ManagedConnection({
      connect: async () => {
        connectCount += 1
        return p.ws.connect({ url: 'ws://localhost:9312' })
      },
      heartbeat: { idleMs: 10, timeoutMs: 15, probeMessage: { type: 'probe' } },
    })
    const closeConn = trackClose(() => conn.close())

    expect(await conn.send({ type: 'ok' })).toBe('ok')
    await wait(70)
    expect(conn.connected).toBe(false)

    expect(await conn.send({ type: 'ok' })).toBe('ok')
    expect(connectCount).toBe(2)

    await closeConn()
    await closeServer()
  })

  it('stops heartbeat/reconnect after explicit close', async () => {
    const p = setup()
    const R = p.classes.Resource
    const localScope = p.resource(new (class extends R {
      get() {
        return 'ok'
      }
    })())

    const server = p.ws.serve({ port: 9313, localScope })
    const closeServer = trackClose(server.close)

    let connectCount = 0
    const conn = new p.client.ManagedConnection({
      connect: async () => {
        connectCount += 1
        return p.ws.connect({ url: 'ws://localhost:9313' })
      },
      heartbeat: { idleMs: 10, timeoutMs: 20, probeMessage: {} },
    })

    expect(await conn.send({ type: 'ok' })).toBe('ok')
    expect(connectCount).toBe(1)

    await conn.close()
    await wait(40)
    expect(connectCount).toBe(1)
    await expect(conn.send({ type: 'ok' })).rejects.toMatchObject({ code: 'E_CLOSED' })

    await closeServer()
  })
})
