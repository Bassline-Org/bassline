import { describe, it, expect, afterEach } from 'vitest'
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws'
import { Platform, kResource } from '../src/kernel/platform.js'
import { reducers, scope } from '../src/resources/index.js'
import link from '../src/link/runtime.js'
import wsPlatform, { wsTransport } from '../src/platforms/ws.js'

let cleanups = []
afterEach(async () => {
  for (const fn of cleanups.reverse()) await fn()
  cleanups = []
})

function setup() {
  const p = new Platform()
  p.use(reducers, scope, link, wsPlatform)
  return p
}

function rawServer(port) {
  const wss = new WebSocketServer({ port })
  cleanups.push(() => {
    for (const ws of wss.clients) ws.terminate()
    return new Promise(r => wss.close(r))
  })
  return wss
}

function listening(wss) {
  return new Promise((resolve, reject) => {
    wss.on('listening', resolve)
    wss.on('error', reject)
  })
}

function rawConnect(port) {
  return new Promise((resolve, reject) => {
    const ws = new WsWebSocket(`ws://localhost:${port}`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

describe('wsTransport', () => {
  it('JSON round-trip: server -> client', async () => {
    const wss = rawServer(9300)
    await listening(wss)

    const serverReady = new Promise(r => wss.on('connection', r))
    const clientWs = await rawConnect(9300)
    const serverWs = await serverReady

    const serverT = wsTransport(serverWs)
    const clientT = wsTransport(clientWs)

    const received = new Promise(r => clientT.onMessage(r))
    serverT.send({ hello: 'world', n: 42 })
    expect(await received).toEqual({ hello: 'world', n: 42 })
  })

  it('send-after-close throws', async () => {
    const wss = rawServer(9301)
    await listening(wss)

    const serverReady = new Promise(r => wss.on('connection', r))
    const clientWs = await rawConnect(9301)
    await serverReady

    const t = wsTransport(clientWs)
    t.close()
    expect(() => t.send({ x: 1 })).toThrow('transport closed')
  })
})

describe('Link over WebSocket', () => {
  async function connected(port, deployRoot) {
    const p = setup()
    await p.deploy(deployRoot)

    const { wss, close } = p.ws.serve({ port, localScope: p.root })
    cleanups.push(close)
    await listening(wss)

    const clientHandle = await p.ws.connect({ url: `ws://localhost:${port}` })
    cleanups.push(() => clientHandle.close?.())

    return { p, remote: clientHandle.remoteScope, clientHandle, close, wss }
  }

  it('reads scalar values', async () => {
    const { remote } = await connected(9302, p => {
      p.root({ put: p.create.Slot({ value: 42 }), at: 'counter' })
    })
    const counter = await remote({ at: 'counter' })
    expect(await counter({})).toBe(42)
  })

  it('writes scalar values', async () => {
    let localCounter
    const { remote } = await connected(9303, p => {
      localCounter = p.create.Slot({ value: 0 })
      p.root({ put: localCounter, at: 'counter' })
    })
    const counter = await remote({ at: 'counter' })
    await counter({ put: 99 })
    expect(localCounter({})).toBe(99)
  })

  it('supports listing/walk/has/meta', async () => {
    const { remote } = await connected(9304, p => {
      p.root({ put: { cells: { x: p.create.Slot({ value: 7 }) } } })
      p.root({ put: p.create.Slot({ value: 1 }), at: 'a', meta: { size: 10 } })
    })
    const listing = await remote({})
    expect(listing.hrefs).toContain('cells')
    expect(await remote({ has: 'a' })).toBe(true)
    expect(await remote({ meta: 'a' })).toEqual({ size: 10 })
    const x = await remote({ walk: 'cells/x' })
    expect(await x({})).toBe(7)
  })

  it('keeps capability refs location-transparent', async () => {
    const { remote } = await connected(9305, p => {
      const slot = p.create.Slot({ value: 'ok' })
      const R = p.classes.Resource
      const bundle = p.resource(new (class extends R {
        get() { return { child: slot } }
      })())
      p.root({ put: bundle, at: 'bundle' })
    })

    const bundle = await remote({ at: 'bundle' })
    const payload = await bundle({})
    expect(typeof payload.child).toBe('function')
    expect(payload.child[kResource]).toBeTruthy()
    expect(await payload.child({})).toBe('ok')
  })

  it('supports multiple independent clients', async () => {
    const p = setup()
    await p.deploy(pl => {
      pl.root({ put: pl.create.Slot({ value: 'shared' }), at: 'data' })
    })

    const { wss, close } = p.ws.serve({ port: 9306, localScope: p.root })
    cleanups.push(close)
    await listening(wss)

    const c1 = await p.ws.connect({ url: 'ws://localhost:9306' })
    const c2 = await p.ws.connect({ url: 'ws://localhost:9306' })
    cleanups.push(() => c1.close?.(), () => c2.close?.())

    const r1 = await c1.remoteScope({ at: 'data' })
    const r2 = await c2.remoteScope({ at: 'data' })
    expect(await r1({})).toBe('shared')
    expect(await r2({})).toBe('shared')
  })

  it('server close rejects pending requests', async () => {
    const p = setup()
    await p.deploy(pl => {
      const Slow = pl.classes.Resource
      const slow = pl.resource(new (class extends Slow {
        get() { return new Promise(() => {}) }
      })())
      pl.root({ put: slow, at: 'slow' })
    })

    const { wss, close } = p.ws.serve({ port: 9307, localScope: p.root })
    cleanups.push(close)
    await listening(wss)

    const client = await p.ws.connect({ url: 'ws://localhost:9307' })
    const slow = await client.remoteScope({ at: 'slow' })
    const pending = slow({})

    await close()
    await expect(pending).rejects.toMatchObject({ code: 'E_CLOSED' })
  })

  it('client disconnect closes server socket', async () => {
    const p = setup()
    await p.deploy(pl => {
      pl.root({ put: pl.create.Slot({ value: 1 }), at: 'x' })
    })
    const { wss, close } = p.ws.serve({ port: 9308, localScope: p.root })
    cleanups.push(close)
    await listening(wss)

    const serverClosed = new Promise(resolve => {
      wss.on('connection', ws => ws.on('close', () => resolve('closed')))
    })

    const client = await p.ws.connect({ url: 'ws://localhost:9308' })
    client.close()
    expect(await serverClosed).toBe('closed')
  })

  it('connect failure rejects', async () => {
    const p = setup()
    await expect(p.ws.connect({ url: 'ws://localhost:9399' })).rejects.toThrow()
  })
})
