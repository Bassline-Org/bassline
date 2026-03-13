import { describe, it, expect } from 'vitest'
import { Platform, kResource } from '../src/kernel/platform.js'
import { reducers, scope } from '../src/resources/index.js'
import link, { memoryTransport } from '../src/link/runtime.js'

function setup() {
  const p = new Platform()
  p.use(reducers, scope, link)
  return p
}

/**
 * @param {import('../src/types').ResourceFn} localScope
 */
function bridge(localScope) {
  const p = setup()
  const { a, b } = memoryTransport()
  const server = p.link.open({ transport: a, localScope })
  const clientHandle = p.link.open({
    transport: b,
    localScope: p.create.Scope(),
  })
  return { p, a, b, server, clientHandle, client: clientHandle.remoteScope }
}

describe('Link over memory transport', () => {
  it('reads and writes scalar values through remoteScope', async () => {
    const p = setup()
    const root = p.create.Scope()
    const counter = p.create.Slot({ value: 0 })
    root({ put: counter, at: 'counter' })

    const { client } = bridge(root)
    const remoteCounter = await client({ at: 'counter' })
    await remoteCounter({ put: 42 })
    expect(counter({})).toBe(42)
    expect(await remoteCounter({})).toBe(42)
  })

  it('supports listing, walk, has, and meta parity', async () => {
    const p = setup()
    const root = p.create.Scope()
    root({
      put: {
        cells: {
          counter: p.create.Slot({ value: 7 }),
        },
      },
    })
    root({ put: p.create.Slot({ value: 1 }), at: 'x', meta: { size: 100 } })

    const { client } = bridge(root)

    const listing = await client({})
    expect(listing.hrefs).toContain('cells')
    expect(await client({ has: 'x' })).toBe(true)
    expect(await client({ meta: 'x' })).toEqual({ size: 100 })

    const counter = await client({ walk: 'cells/counter' })
    expect(await counter({})).toBe(7)
  })

  it('maps concurrent requests by id correctly', async () => {
    const p = setup()
    const root = p.create.Scope({
      entries: {
        x: p.create.Slot({ value: 'a' }),
        y: p.create.Slot({ value: 'b' }),
        z: p.create.Slot({ value: 'c' }),
      },
    })

    const { client } = bridge(root)
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

  it('rejects pending requests with E_CLOSED on close', async () => {
    const p = setup()
    const root = p.create.Scope()
    const Slow = p.classes.Resource
    const slow = p.resource(new (class extends Slow {
      get() {
        return new Promise(() => {})
      }
    })())
    root({ put: slow, at: 'slow' })

    const { client, clientHandle } = bridge(root)
    const remoteSlow = await client({ at: 'slow' })
    const pending = remoteSlow({})
    clientHandle.close()
    await expect(pending).rejects.toMatchObject({ code: 'E_CLOSED' })
  })

  it('passes resource function capabilities through parked refs', async () => {
    const p = setup()
    const root = p.create.Scope()
    const slot = p.create.Slot({ value: 'hello' })
    const R = p.classes.Resource
    const bundle = p.resource(new (class extends R {
      get() {
        return { child: slot }
      }
    })())
    root({ put: bundle, at: 'bundle' })

    const { client } = bridge(root)
    const remoteBundle = await client({ at: 'bundle' })
    const payload = await remoteBundle({})

    expect(typeof payload.child).toBe('function')
    expect(payload.child[kResource]).toBeTruthy()
    expect(await payload.child({})).toBe('hello')
  })
})

describe('Link protocol behavior', () => {
  it('malformed envelope closes the link with protocol failure', async () => {
    const p = setup()
    const root = p.create.Scope()
    const { a, b } = memoryTransport()
    const server = p.link.open({ transport: a, localScope: root })

    b.send('not-json')
    await new Promise(r => setTimeout(r, 0))

    expect(server.closed).toBe(true)
  })

  it('invalid targetRef is denied with E_TARGET and link stays open', async () => {
    const p = setup()
    const root = p.create.Scope()
    root({ put: p.create.Slot({ value: 1 }), at: 'x' })

    const { a, b } = memoryTransport()
    const server = p.link.open({ transport: a, localScope: root })

    const reply = new Promise(resolve => b.onMessage(resolve))
    b.send({
      v: 1,
      id: 'req-invalid-target',
      op: 'REQUEST',
      targetRef: 'bogus-token',
      msg: {},
    })

    const frame = await reply
    expect(frame.ok).toBe(false)
    expect(frame.error.code).toBe('E_TARGET')
    expect(server.closed).toBe(false)
  })

})
