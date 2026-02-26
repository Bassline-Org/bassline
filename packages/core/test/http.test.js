import { describe, it, expect, afterEach } from 'vitest'
import { Platform } from '../src/platform.js'
import { reducers, scope } from '../src/modules/index.js'
import http from '../src/platforms/http.js'

function setup() {
  const p = new Platform()
  p.use(reducers, scope, http)
  return p
}

async function request(port, path, opts = {}) {
  const { method = 'GET', headers = {}, body } = opts
  const url = `http://localhost:${port}${path}`
  const init = { method, headers }
  if (body !== undefined) init.body = JSON.stringify(body)
  const res = await fetch(url, init)
  const text = await res.text()
  return {
    status: res.status,
    body: text ? JSON.parse(text) : undefined,
  }
}

let cleanup = []

afterEach(async () => {
  for (const close of cleanup) await close()
  cleanup = []
})

function serve(platform, port) {
  const { server, close } = platform.serve({ port })
  cleanup.push(close)
  return new Promise(resolve => server.on('listening', () => resolve({ server, close })))
}

describe('HTTP platform', () => {
  it('GET / returns root children as links', async () => {
    const p = setup()
    p.root({ put: p.create.Slot({ value: 0 }), at: 'counter' })
    p.root({ put: p.create.Slot({ value: '' }), at: 'title' })
    await serve(p, 9100)

    const res = await request(9100, '/')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      hrefs: [
        { name: 'counter', href: '/counter' },
        { name: 'title', href: '/title' },
      ],
    })
  })

  it('GET /counter returns slot value', async () => {
    const p = setup()
    p.root({ put: p.create.Slot({ value: 42 }), at: 'counter' })
    await serve(p, 9101)

    const res = await request(9101, '/counter')
    expect(res.status).toBe(200)
    expect(res.body).toBe(42)
  })

  it('GET walks nested paths', async () => {
    const p = setup()
    p.root({ put: { cells: { counter: p.create.Slot({ value: 99 }) } } })
    await serve(p, 9102)

    const res = await request(9102, '/cells/counter')
    expect(res.status).toBe(200)
    expect(res.body).toBe(99)
  })

  it('PUT updates a slot value', async () => {
    const p = setup()
    p.root({ put: p.create.Slot({ value: 0, reduce: Math.max }), at: 'counter' })
    await serve(p, 9103)

    const res = await request(9103, '/counter', { method: 'PUT', body: 5 })
    expect(res.status).toBe(200)
    expect(res.body).toBe(5)

    const get = await request(9103, '/counter')
    expect(get.body).toBe(5)
  })

  it('X-Bl header passes message fields', async () => {
    const p = setup()
    p.root({ put: p.create.Slot({ value: 0 }), at: 'counter' })
    await serve(p, 9104)

    const res = await request(9104, '/', {
      headers: { 'X-Bl': JSON.stringify({ has: 'counter' }) },
    })
    expect(res.status).toBe(200)
    expect(res.body).toBe(true)
  })

  it('returns 404 for non-existent path', async () => {
    const p = setup()
    await serve(p, 9105)

    const res = await request(9105, '/missing')
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/)
  })

  it('returns 405 for unsupported methods', async () => {
    const p = setup()
    await serve(p, 9106)

    const res = await request(9106, '/', { method: 'DELETE' })
    expect(res.status).toBe(405)
  })

  it('POST works same as PUT', async () => {
    const p = setup()
    p.root({ put: p.create.Slot({ value: 0, reduce: Math.max }), at: 'x' })
    await serve(p, 9107)

    const res = await request(9107, '/x', { method: 'POST', body: 10 })
    expect(res.status).toBe(200)
    expect(res.body).toBe(10)
  })

  it('PUT with X-Bl header merges msg fields', async () => {
    const p = setup()
    p.root({ put: { cells: {} } })
    await serve(p, 9108)

    // PUT a new slot into cells scope
    const slot = p.create.Slot({ value: 'hello' })
    // Mount directly and verify via HTTP
    const cells = p.root({ at: 'cells' })
    cells({ put: slot, at: 'greeting' })

    const res = await request(9108, '/cells/greeting')
    expect(res.status).toBe(200)
    expect(res.body).toBe('hello')
  })

  it('returns 400 for malformed X-Bl header', async () => {
    const p = setup()
    await serve(p, 9109)

    const res = await request(9109, '/', {
      headers: { 'X-Bl': 'not-json' },
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/malformed/)
  })

  it('GET /scope returns children as links', async () => {
    const p = setup()
    p.root({ put: { cells: { counter: p.create.Slot({ value: 0 }), title: p.create.Slot({ value: '' }) } } })
    await serve(p, 9110)

    const res = await request(9110, '/cells')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      hrefs: [
        { name: 'counter', href: '/cells/counter' },
        { name: 'title', href: '/cells/title' },
      ],
    })
  })

  it('returns null for undefined result', async () => {
    const p = setup()
    p.root({ put: p.create.Slot({ value: undefined }), at: 'x' })
    await serve(p, 9111)

    const res = await request(9111, '/x')
    expect(res.status).toBe(200)
    expect(res.body).toBe(null)
  })

  it('close() shuts down the server', async () => {
    const p = setup()
    const { server, close } = p.serve({ port: 9112 })
    await new Promise(resolve => server.on('listening', resolve))
    await close()
    await expect(fetch('http://localhost:9112/')).rejects.toThrow()
  })
})
