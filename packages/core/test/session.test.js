import { describe, it, expect } from 'vitest'
import { Platform, kResource } from '../src/platform.js'
import { reducers, scope, garage } from '../src/modules/index.js'
import session, { memoryTransport } from '../src/modules/session.js'

function setup() {
  const p = new Platform()
  p.use(reducers, scope, garage, session)
  return p
}

function bridge(root) {
  const p = setup()
  const { a, b } = memoryTransport()
  const server = p.create.Session({ transport: a, root })
  const client = p.create.Session({ transport: b })
  return { server, client, p }
}

describe('BSP Session', () => {
  describe('memoryTransport', () => {
    it('delivers messages between endpoints', () => {
      const { a, b } = memoryTransport()
      const received = []
      b.onMessage(msg => received.push(msg))
      a.send({ hello: 'world' })
      expect(received).toEqual([{ hello: 'world' }])
    })

    it('delivers in both directions', () => {
      const { a, b } = memoryTransport()
      const aReceived = []
      const bReceived = []
      a.onMessage(msg => aReceived.push(msg))
      b.onMessage(msg => bReceived.push(msg))
      a.send('to-b')
      b.send('to-a')
      expect(bReceived).toEqual(['to-b'])
      expect(aReceived).toEqual(['to-a'])
    })

    it('close propagates to both endpoints', () => {
      const { a, b } = memoryTransport()
      let aClosed = false
      let bClosed = false
      a.onClose(() => { aClosed = true })
      b.onClose(() => { bClosed = true })
      a.close()
      expect(aClosed).toBe(true)
      expect(bClosed).toBe(true)
    })

    it('throws on send after close', () => {
      const { a, b } = memoryTransport()
      a.close()
      expect(() => a.send('nope')).toThrow('transport closed')
      expect(() => b.send('nope')).toThrow('transport closed')
    })

    it('close is idempotent', () => {
      const { a, b } = memoryTransport()
      let count = 0
      a.onClose(() => count++)
      a.close()
      a.close()
      expect(count).toBe(1)
    })
  })

  describe('scalar values', () => {
    it('reads a slot value through session', async () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 42 }), at: 'counter' })
      const { client } = bridge(root)

      const counter = await client({ at: 'counter' })
      const value = await counter({})
      expect(value).toBe(42)
    })

    it('writes to a slot through session', async () => {
      const p = setup()
      const counter = p.create.Slot({ value: 0 })
      const root = p.create.Scope()
      root({ put: counter, at: 'counter' })
      const { client } = bridge(root)

      const remoteCounter = await client({ at: 'counter' })
      await remoteCounter({ put: 99 })
      expect(counter({})).toBe(99)
    })

    it('reads string values', async () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 'hello' }), at: 'title' })
      const { client } = bridge(root)

      const title = await client({ at: 'title' })
      const value = await title({})
      expect(value).toBe('hello')
    })
  })

  describe('scope operations', () => {
    it('lists children of root scope', async () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 1 }), at: 'a' })
      root({ put: p.create.Slot({ value: 2 }), at: 'b' })
      const { client } = bridge(root)

      const listing = await client({})
      expect(listing).toEqual({ hrefs: ['a', 'b'] })
    })

    it('lists children of nested scope', async () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: { cells: { x: p.create.Slot({ value: 1 }), y: p.create.Slot({ value: 2 }) } } })
      const { client } = bridge(root)

      const cells = await client({ at: 'cells' })
      const listing = await cells({})
      expect(listing).toEqual({ hrefs: ['x', 'y'] })
    })

    it('walks a path through nested scopes', async () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: { a: { b: { c: p.create.Slot({ value: 'deep' }) } } } })
      const { client } = bridge(root)

      const c = await client({ walk: 'a/b/c' })
      const value = await c({})
      expect(value).toBe('deep')
    })

    it('checks existence remotely', async () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 1 }), at: 'exists' })
      const { client } = bridge(root)

      expect(await client({ has: 'exists' })).toBe(true)
      expect(await client({ has: 'nope' })).toBe(false)
    })

    it('retrieves metadata remotely', async () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 1 }), at: 'x', meta: { size: 100 } })
      const { client } = bridge(root)

      const meta = await client({ meta: 'x' })
      expect(meta).toEqual({ size: 100 })
    })
  })

  describe('$ref: resource references', () => {
    it('resource-valued returns become working proxies with kResource', async () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 42 }), at: 'counter' })
      const { client } = bridge(root)

      const counter = await client({ at: 'counter' })
      expect(typeof counter).toBe('function')
      expect(counter[kResource]).toBeTruthy()
      expect(await counter({})).toBe(42)
    })

    it('same resource returns same proxy (identity)', async () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 1 }), at: 'x' })
      const { client } = bridge(root)

      const proxy1 = await client({ at: 'x' })
      const proxy2 = await client({ at: 'x' })
      expect(proxy1).toBe(proxy2)
    })

    it('refs nested in objects are decoded', async () => {
      const p = setup()
      const slot = p.create.Slot({ value: 'test' })

      // A resource whose get() returns an object containing a resource fn
      const bundle = p.resource(new (class extends p.classes.Resource {
        get() { return { child: slot } }
      })())
      const root = p.create.Scope()
      root({ put: bundle, at: 'bundle' })
      const { client } = bridge(root)

      const remoteBundle = await client({ at: 'bundle' })
      const result = await remoteBundle({})
      expect(typeof result.child).toBe('function')
      expect(result.child[kResource]).toBeTruthy()
      expect(await result.child({})).toBe('test')
    })

    it('refs nested in arrays are decoded', async () => {
      const p = setup()
      const slot = p.create.Slot({ value: 'arr' })

      const list = p.resource(new (class extends p.classes.Resource {
        get() { return [slot, 42] }
      })())
      const root = p.create.Scope()
      root({ put: list, at: 'list' })
      const { client } = bridge(root)

      const remoteList = await client({ at: 'list' })
      const result = await remoteList({})
      expect(Array.isArray(result)).toBe(true)
      expect(typeof result[0]).toBe('function')
      expect(result[0][kResource]).toBeTruthy()
      expect(await result[0]({})).toBe('arr')
      expect(result[1]).toBe(42)
    })
  })

  describe('symmetric', () => {
    it('both peers serve and request', async () => {
      const p = setup()
      const rootA = p.create.Scope()
      rootA({ put: p.create.Slot({ value: 'from-A' }), at: 'data' })
      const rootB = p.create.Scope()
      rootB({ put: p.create.Slot({ value: 'from-B' }), at: 'data' })

      const { a, b } = memoryTransport()
      const sessionA = p.create.Session({ transport: a, root: rootA })
      const sessionB = p.create.Session({ transport: b, root: rootB })

      // B requests from A
      const proxyA = await sessionB({ at: 'data' })
      expect(await proxyA({})).toBe('from-A')

      // A requests from B
      const proxyB = await sessionA({ at: 'data' })
      expect(await proxyB({})).toBe('from-B')
    })
  })

  describe('error forwarding', () => {
    it('forwards errors from the remote peer', async () => {
      const p = setup()
      const root = p.create.Scope()
      const { client } = bridge(root)

      await expect(client({ at: 'nonexistent' })).rejects.toThrow('not found')
    })
  })

  describe('transport close', () => {
    it('rejects pending requests on close', async () => {
      const { a, b } = memoryTransport()
      // No server — messages have no handler
      const p = setup()
      const client = p.create.Session({ transport: b })

      const promise = client({})
      a.close()
      await expect(promise).rejects.toThrow('session closed')
    })

    it('sets closed = true on transport close', () => {
      const p = setup()
      const { a, b } = memoryTransport()
      const sess = p.create.Session({ transport: a })
      expect(sess[kResource].closed).toBe(false)
      b.close()
      expect(sess[kResource].closed).toBe(true)
    })
  })

  describe('proxy reflection', () => {
    it('platform.reflect works on remote proxies', async () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 1 }), at: 'x' })
      const { client, p: sp } = bridge(root)

      const proxy = await client({ at: 'x' })
      const mirror = sp.reflect(proxy)
      expect(mirror).not.toBeNull()
    })

    it('accept dispatches to visitRemoteResource', async () => {
      const p = setup()
      const root = p.create.Scope()
      root({ put: p.create.Slot({ value: 1 }), at: 'x' })
      const { client, p: sp } = bridge(root)

      const proxy = await client({ at: 'x' })
      const mirror = sp.reflect(proxy)
      let visited = false
      mirror.accept({
        visitRemoteResource(r) { visited = true; return r },
        visitResource(r) { return r },
      })
      expect(visited).toBe(true)
    })
  })

  describe('no root', () => {
    it('rejects incoming requests when no root', async () => {
      const p = setup()
      const { a, b } = memoryTransport()
      p.create.Session({ transport: a })
      const client = p.create.Session({ transport: b })

      await expect(client({ at: 'x' })).rejects.toThrow('no root')
    })
  })

  describe('reducers over session', () => {
    it('Max reducer works through session', async () => {
      const p = setup()
      const max = p.create.Max({ value: 0 })
      const root = p.create.Scope()
      root({ put: max, at: 'max' })
      const { client } = bridge(root)

      const remoteMax = await client({ at: 'max' })
      await remoteMax({ put: 5 })
      await remoteMax({ put: 3 })
      await remoteMax({ put: 10 })
      expect(await remoteMax({})).toBe(10)
      expect(max({})).toBe(10)
    })
  })

  describe('nested resource traversal', () => {
    it('resolves resources returned from child scopes', async () => {
      const p = setup()
      const root = p.create.Scope()
      const inner = p.create.Scope()
      inner({ put: p.create.Slot({ value: 'nested' }), at: 'val' })
      root({ put: inner, at: 'inner' })
      const { client } = bridge(root)

      const remoteInner = await client({ at: 'inner' })
      const remoteVal = await remoteInner({ at: 'val' })
      expect(await remoteVal({})).toBe('nested')
    })
  })
})
