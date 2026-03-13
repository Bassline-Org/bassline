import { describe, it, expect } from 'vitest'
import { Platform } from '../src/kernel/platform.js'
import { reducers, scope } from '../src/resources/index.js'
import { memoryTransport } from '../src/link/runtime.js'
import link from '../src/link/runtime.js'
import client from '../src/link/client.js'

function setup() {
  const p = new Platform()
  p.use(reducers, scope, link, client)
  return p
}

function wait(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * @param {import('../src/kernel/platform.js').Platform} p
 * @param {import('../src/types').ResourceFn} localScope
 * @param {{ connectDelayMs?: number }} [opts]
 */
function createConnector(p, localScope, { connectDelayMs = 0 } = {}) {
  let connectCount = 0
  let lastServer = null
  let lastClient = null

  return {
    async connect() {
      connectCount += 1
      if (connectDelayMs > 0) await wait(connectDelayMs)
      const { a, b } = memoryTransport()
      lastServer = p.link.open({ transport: a, localScope })
      lastClient = p.link.open({ transport: b, localScope: p.create.Scope() })
      return lastClient
    },
    get connectCount() {
      return connectCount
    },
    get lastServer() {
      return lastServer
    },
    get lastClient() {
      return lastClient
    },
  }
}

describe('ManagedConnection over memory transport', () => {
  it('first send establishes connection', async () => {
    const p = setup()
    const root = p.create.Scope()
    root({ put: p.create.Slot({ value: 1 }), at: 'x' })
    const connector = createConnector(p, root)

    const conn = new p.client.ManagedConnection({ connect: connector.connect })
    expect(await conn.send({ has: 'x' })).toBe(true)
    expect(connector.connectCount).toBe(1)
  })

  it('specialized controller methods dispatch messages through connection', async () => {
    const p = setup()
    const root = p.create.Scope()
    const counter = p.create.Slot({ value: 0 })
    root({ put: counter, at: 'counter' })

    class CounterController {
      constructor(conn) {
        this.conn = conn
      }
      async value() {
        const ref = await this.conn.send({ at: 'counter' })
        return ref({})
      }
      async increment() {
        const ref = await this.conn.send({ at: 'counter' })
        const current = await ref({})
        await ref({ put: current + 1 })
        return ref({})
      }
    }

    const connector = createConnector(p, root)
    const conn = new p.client.ManagedConnection({ connect: connector.connect })
    const controller = new CounterController(conn)

    expect(await controller.value()).toBe(0)
    expect(await controller.increment()).toBe(1)
    expect(counter({})).toBe(1)
  })

  it('supports per-call timeout override', async () => {
    const p = setup()
    const R = p.classes.Resource
    const slowRoot = p.resource(new (class extends R {
      get(msg = {}) {
        if (msg.type === 'slow') return new Promise(() => {})
        return 'ok'
      }
    })())

    const connector = createConnector(p, slowRoot)
    const conn = new p.client.ManagedConnection({ connect: connector.connect })

    await expect(conn.send({ type: 'slow' }, { timeoutMs: 20 })).rejects.toMatchObject({
      code: 'E_TIMEOUT',
      source: 'client',
    })
  })

  it('supports abort signal handling', async () => {
    const p = setup()
    const R = p.classes.Resource
    const slowRoot = p.resource(new (class extends R {
      get(msg = {}) {
        if (msg.type === 'slow') return new Promise(() => {})
        return 'ok'
      }
    })())

    const connector = createConnector(p, slowRoot)
    const conn = new p.client.ManagedConnection({ connect: connector.connect })
    const ac = new AbortController()

    const pending = conn.send({ type: 'slow' }, { signal: ac.signal })
    ac.abort()
    await expect(pending).rejects.toMatchObject({
      code: 'E_ABORT',
      source: 'client',
      name: 'AbortError',
    })
  })

  it('fails in-flight calls when link closes and does not replay', async () => {
    const p = setup()
    const R = p.classes.Resource
    const local = p.resource(new (class extends R {
      get(msg = {}) {
        if (msg.type === 'slow') return new Promise(() => {})
        return 'ok'
      }
    })())

    const connector = createConnector(p, local)
    const conn = new p.client.ManagedConnection({ connect: connector.connect })

    const pending = conn.send({ type: 'slow' })
    await wait(0)
    connector.lastServer.close()

    await expect(pending).rejects.toMatchObject({ code: 'E_CLOSED' })
    expect(connector.connectCount).toBe(1)
  })

  it('reconnects on next call after close', async () => {
    const p = setup()
    const R = p.classes.Resource
    const local = p.resource(new (class extends R {
      get(msg = {}) {
        if (msg.type === 'slow') return new Promise(() => {})
        return 'ok'
      }
    })())

    const connector = createConnector(p, local)
    const conn = new p.client.ManagedConnection({ connect: connector.connect })

    const pending = conn.send({ type: 'slow' })
    await wait(0)
    connector.lastServer.close()
    await expect(pending).rejects.toMatchObject({ code: 'E_CLOSED' })

    expect(await conn.send({ type: 'ok' })).toBe('ok')
    expect(connector.connectCount).toBe(2)
  })

  it('shares one reconnect attempt across concurrent calls', async () => {
    const p = setup()
    const R = p.classes.Resource
    const local = p.resource(new (class extends R {
      get(msg = {}) {
        return msg.value ?? 'ok'
      }
    })())

    const connector = createConnector(p, local, { connectDelayMs: 20 })
    const conn = new p.client.ManagedConnection({ connect: connector.connect })

    expect(await conn.send({ value: 'first' })).toBe('first')
    connector.lastServer.close()
    await wait(0)

    const [a, b] = await Promise.all([
      conn.send({ value: 'a' }),
      conn.send({ value: 'b' }),
    ])

    expect(a).toBe('a')
    expect(b).toBe('b')
    expect(connector.connectCount).toBe(2)
  })

  it('runs heartbeat probe only when idle', async () => {
    const p = setup()
    const R = p.classes.Resource
    let probes = 0
    const local = p.resource(new (class extends R {
      get(msg = {}) {
        if (msg.type === 'probe') {
          probes += 1
          return 'probe-ok'
        }
        if (msg.type === 'work') {
          return new Promise(resolve => setTimeout(() => resolve('work-ok'), 40))
        }
        return 'ok'
      }
    })())

    const connector = createConnector(p, local)
    const conn = new p.client.ManagedConnection({
      connect: connector.connect,
      heartbeat: { idleMs: 15, timeoutMs: 20, probeMessage: { type: 'probe' } },
    })

    const work = conn.send({ type: 'work' })
    await wait(25)
    expect(probes).toBe(0)
    await work
    await wait(5)
    expect(probes).toBe(0)
    await wait(25)
    expect(probes).toBeGreaterThanOrEqual(1)
  })

  it('invalidates connection on heartbeat failure and reconnects on next send', async () => {
    const p = setup()
    const R = p.classes.Resource
    const local = p.resource(new (class extends R {
      get(msg = {}) {
        if (msg.type === 'probe') return new Promise(() => {})
        return 'ok'
      }
    })())

    const connector = createConnector(p, local)
    const conn = new p.client.ManagedConnection({
      connect: connector.connect,
      heartbeat: { idleMs: 10, timeoutMs: 15, probeMessage: { type: 'probe' } },
    })

    expect(await conn.send({ type: 'ok' })).toBe('ok')
    await wait(50)
    expect(conn.connected).toBe(false)

    expect(await conn.send({ type: 'ok' })).toBe('ok')
    expect(connector.connectCount).toBe(2)
  })
})
