import { describe, it, expect, afterEach } from 'vitest'
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws'
import { Platform, kResource } from '../src/platform.js'
import { reducers, scope, garage, session } from '../src/modules/index.js'
import wsPlatform, { wsTransport } from '../src/platforms/ws.js'

let cleanups = []
afterEach(async () => {
  for (const fn of cleanups.reverse()) await fn()
  cleanups = []
})

function setup() {
  const p = new Platform()
  p.use(reducers, scope, garage, session, wsPlatform)
  return p
}

/** Start a raw WS server, closing all clients on teardown. */
function rawServer(port) {
  const wss = new WebSocketServer({ port })
  cleanups.push(() => {
    for (const ws of wss.clients) ws.terminate()
    return new Promise(r => wss.close(r))
  })
  return wss
}

/** Wait for a WebSocket server to be listening. */
function listening(wss) {
  return new Promise((resolve, reject) => {
    wss.on('listening', resolve)
    wss.on('error', reject)
  })
}

/** Connect a raw ws-library WebSocket. */
function rawConnect(port) {
  return new Promise((resolve, reject) => {
    const ws = new WsWebSocket(`ws://localhost:${port}`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

// ─── wsTransport adapter ───────────────────────────────────────────

describe('wsTransport', () => {
  it('JSON round-trip: server → client', async () => {
    const wss = rawServer(9200)
    await listening(wss)

    const serverReady = new Promise(r => wss.on('connection', r))
    const clientWs = await rawConnect(9200)
    const serverWs = await serverReady

    const serverT = wsTransport(serverWs)
    const clientT = wsTransport(clientWs)

    const received = new Promise(r => clientT.onMessage(r))
    serverT.send({ hello: 'world', n: 42 })
    expect(await received).toEqual({ hello: 'world', n: 42 })
  })

  it('JSON round-trip: client → server', async () => {
    const wss = rawServer(9201)
    await listening(wss)

    const serverReady = new Promise(r => wss.on('connection', r))
    const clientWs = await rawConnect(9201)
    const serverWs = await serverReady

    const serverT = wsTransport(serverWs)
    const clientT = wsTransport(clientWs)

    const received = new Promise(r => serverT.onMessage(r))
    clientT.send({ from: 'client' })
    expect(await received).toEqual({ from: 'client' })
  })

  it('close propagation', async () => {
    const wss = rawServer(9202)
    await listening(wss)

    const serverReady = new Promise(r => wss.on('connection', r))
    const clientWs = await rawConnect(9202)
    const serverWs = await serverReady

    const serverT = wsTransport(serverWs)
    const clientT = wsTransport(clientWs)

    const closed = new Promise(r => serverT.onClose(r))
    clientT.close()
    await closed
  })

  it('send-after-close throws', async () => {
    const wss = rawServer(9203)
    await listening(wss)

    const serverReady = new Promise(r => wss.on('connection', r))
    const clientWs = await rawConnect(9203)
    await serverReady

    const t = wsTransport(clientWs)
    t.close()
    expect(() => t.send({ x: 1 })).toThrow('transport closed')
  })
})

// ─── Session over WebSocket ────────────────────────────────────────

describe('Session over WebSocket', () => {
  /** Full setup: platform with root content, ws server, ws client session. */
  async function connected(port, deployRoot) {
    const p = setup()
    await p.deploy(deployRoot)

    const { wss, close } = p.ws.serve({ port })
    cleanups.push(close)
    await listening(wss)

    const client = await p.ws.connect({ url: `ws://localhost:${port}` })
    cleanups.push(() => client.close?.())

    return { p, client, close }
  }

  it('read scalar value', async () => {
    const { client } = await connected(9204, p => {
      p.root({ put: p.create.Slot({ value: 42 }), at: 'counter' })
    })
    const counter = await client({ at: 'counter' })
    expect(await counter({})).toBe(42)
  })

  it('write scalar value', async () => {
    let localCounter
    const { client } = await connected(9205, platform => {
      localCounter = platform.create.Slot({ value: 0 })
      platform.root({ put: localCounter, at: 'counter' })
    })
    const remote = await client({ at: 'counter' })
    await remote({ put: 99 })
    expect(localCounter({})).toBe(99)
  })

  it('scope listing', async () => {
    const { client } = await connected(9206, p => {
      p.root({ put: p.create.Slot({ value: 1 }), at: 'a' })
      p.root({ put: p.create.Slot({ value: 2 }), at: 'b' })
    })
    const listing = await client({})
    expect(listing.hrefs).toContain('a')
    expect(listing.hrefs).toContain('b')
  })

  it('walk nested path', async () => {
    const { client } = await connected(9207, p => {
      p.root({ put: { x: { y: { z: p.create.Slot({ value: 'deep' }) } } } })
    })
    const z = await client({ walk: 'x/y/z' })
    expect(await z({})).toBe('deep')
  })

  it('$ref round-trip: proxy has kResource', async () => {
    const { client } = await connected(9208, p => {
      p.root({ put: p.create.Slot({ value: 7 }), at: 'val' })
    })
    const proxy = await client({ at: 'val' })
    expect(typeof proxy).toBe('function')
    expect(proxy[kResource]).toBeTruthy()
    expect(await proxy({})).toBe(7)
  })

  it('$ref identity: same resource → same proxy', async () => {
    const { client } = await connected(9209, p => {
      p.root({ put: p.create.Slot({ value: 1 }), at: 'x' })
    })
    const a = await client({ at: 'x' })
    const b = await client({ at: 'x' })
    expect(a).toBe(b)
  })

  it('has/meta', async () => {
    const { client } = await connected(9210, p => {
      p.root({ put: p.create.Slot({ value: 1 }), at: 'x', meta: { size: 100 } })
    })
    expect(await client({ has: 'x' })).toBe(true)
    expect(await client({ has: 'nope' })).toBe(false)
    expect(await client({ meta: 'x' })).toEqual({ size: 100 })
  })
})

// ─── Server features ───────────────────────────────────────────────

describe('Server features', () => {
  it('multiple connections: independent reads', async () => {
    const p = setup()
    await p.deploy(p => {
      p.root({ put: p.create.Slot({ value: 'shared' }), at: 'data' })
    })
    const { wss, close } = p.ws.serve({ port: 9211 })
    cleanups.push(close)
    await listening(wss)

    const c1 = await p.ws.connect({ url: 'ws://localhost:9211' })
    const c2 = await p.ws.connect({ url: 'ws://localhost:9211' })
    cleanups.push(() => c1.close?.(), () => c2.close?.())

    const ref1 = await c1({ at: 'data' })
    const ref2 = await c2({ at: 'data' })
    expect(await ref1({})).toBe('shared')
    expect(await ref2({})).toBe('shared')
  })

  it('concurrent requests on one connection', async () => {
    const p = setup()
    await p.deploy(p => {
      p.root({ put: p.create.Slot({ value: 'a' }), at: 'x' })
      p.root({ put: p.create.Slot({ value: 'b' }), at: 'y' })
      p.root({ put: p.create.Slot({ value: 'c' }), at: 'z' })
    })
    const { wss, close } = p.ws.serve({ port: 9212 })
    cleanups.push(close)
    await listening(wss)

    const client = await p.ws.connect({ url: 'ws://localhost:9212' })
    cleanups.push(() => client.close?.())

    const [x, y, z] = await Promise.all([
      client({ at: 'x' }),
      client({ at: 'y' }),
      client({ at: 'z' }),
    ])
    const [vx, vy, vz] = await Promise.all([x({}), y({}), z({})])
    expect(vx).toBe('a')
    expect(vy).toBe('b')
    expect(vz).toBe('c')
  })

  it('server close rejects pending client requests', async () => {
    const p = setup()
    await p.deploy(p => {
      p.root({ put: p.create.Slot({ value: 1 }), at: 'x' })
    })
    const { wss, close } = p.ws.serve({ port: 9213 })
    cleanups.push(close)
    await listening(wss)

    const client = await p.ws.connect({ url: 'ws://localhost:9213' })

    const ref = await client({ at: 'x' })
    await close()
    await expect(ref({})).rejects.toThrow()
  })
})

// ─── Lifecycle ─────────────────────────────────────────────────────

describe('Lifecycle', () => {
  it('client disconnect: server session sees close', async () => {
    const p = setup()
    await p.deploy(p => {
      p.root({ put: p.create.Slot({ value: 1 }), at: 'x' })
    })
    const { wss, close } = p.ws.serve({ port: 9214 })
    cleanups.push(close)
    await listening(wss)

    const serverClosed = new Promise(resolve => {
      wss.on('connection', ws => {
        ws.on('close', () => resolve('closed'))
      })
    })

    const client = await p.ws.connect({ url: 'ws://localhost:9214' })
    client.close()

    expect(await serverClosed).toBe('closed')
  })

  it('connect failure: rejects on bad port', async () => {
    const p = setup()
    await expect(
      p.ws.connect({ url: 'ws://localhost:9219' })
    ).rejects.toThrow()
  })
})
