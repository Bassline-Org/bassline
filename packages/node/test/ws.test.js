import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resource } from '@bassline/core'
import WebSocket from 'ws'
import { createWsServer } from '../src/ws.js'

// Test ports - use high numbers to avoid conflicts
const BASE_PORT = 19200

describe('createWsServer', () => {
  let wsServer
  let testPort
  let activeClients = []

  beforeEach(() => {
    wsServer = createWsServer()
    testPort = BASE_PORT + Math.floor(Math.random() * 900)
    activeClients = []
  })

  afterEach(async () => {
    // Close all test clients
    for (const client of activeClients) {
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
        client.close()
      }
    }
    activeClients = []

    // Clean up any running servers
    try {
      const list = await wsServer.get({ path: '/' })
      for (const port of Object.keys(list.body.resources || {})) {
        await wsServer.put({ path: `${port}/stop` })
      }
    } catch {
      // Ignore cleanup errors
    }
    await delay(100) // Allow cleanup
  })

  // Helper to connect client with proper cleanup tracking
  async function connect(port) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}`)
      ws.setMaxListeners(25) // Allow concurrent sendMsg calls in tests
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('Connection timeout'))
      }, 2000)

      ws.once('open', () => {
        clearTimeout(timeout)
        activeClients.push(ws)
        resolve(ws)
      })
      ws.once('error', err => {
        clearTimeout(timeout)
        reject(err)
      })
    })
  }

  // Helper to send message and wait for response
  async function sendMsg(ws, message) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'))
      }, 2000)

      const handler = data => {
        const parsed = JSON.parse(data.toString())
        if (parsed.id === message.id || parsed.type === 'error') {
          clearTimeout(timeout)
          ws.off('message', handler)
          resolve(parsed)
        }
      }
      ws.on('message', handler)
      ws.send(JSON.stringify(message))
    })
  }

  describe('server directory', () => {
    it('lists servers at root', async () => {
      const result = await wsServer.get({ path: '/' })

      expect(result.headers.type).toBe('/types/bassline')
      expect(result.body.name).toBe('ws-servers')
      expect(result.body.resources).toEqual({})
    })

    it('lists running servers with client count', async () => {
      const kit = createMockKit()
      await wsServer.put({ path: `/${testPort}`, kit }, {})
      await delay(50)

      const result = await wsServer.get({ path: '/' })

      expect(result.body.resources).toHaveProperty(`/${testPort}`)
      expect(result.body.resources[`/${testPort}`].clients).toBe(0)
    })
  })

  describe('server lifecycle', () => {
    it('starts server on PUT', async () => {
      const kit = createMockKit()
      const result = await wsServer.put({ path: `/${testPort}`, kit }, {})

      expect(result.headers.type).toBe('/types/ws-server')
      expect(result.body.port).toBe(testPort)
      expect(result.body.status).toBe('running')
    })

    it('gets server status', async () => {
      const kit = createMockKit()
      await wsServer.put({ path: `/${testPort}`, kit }, {})
      await delay(50)

      const result = await wsServer.get({ path: `/${testPort}` })

      expect(result.headers.type).toBe('/types/ws-server')
      expect(result.body.port).toBe(testPort)
      expect(result.body.clients).toBe(0)
      expect(result.body.uptime).toBeGreaterThanOrEqual(0)
    })

    it('returns not-found for unknown port', async () => {
      const result = await wsServer.get({ path: '/99999' })

      expect(result.headers.condition).toBe('not-found')
    })

    it('stops server', async () => {
      const kit = createMockKit()
      await wsServer.put({ path: `/${testPort}`, kit }, {})
      await delay(50)

      const result = await wsServer.put({ path: `/${testPort}/stop` })

      expect(result.body.status).toBe('stopped')
    })

    it('returns not-found when stopping unknown server', async () => {
      const result = await wsServer.put({ path: '/99999/stop' })

      expect(result.headers.condition).toBe('not-found')
    })

    it('closes existing clients when restarting', async () => {
      const kit = createMockKit()
      await wsServer.put({ path: `/${testPort}`, kit }, {})
      await delay(100) // Wait for server to be ready

      const client = await connect(testPort)
      let closed = false
      client.once('close', () => {
        closed = true
      })

      // Restart server
      await wsServer.put({ path: `/${testPort}`, kit }, {})
      await delay(100)

      expect(closed).toBe(true)
    })
  })

  describe('WebSocket message proxying', () => {
    it('proxies GET messages to kit', async () => {
      const kit = createMockKit({ message: 'hello' })
      await wsServer.put({ path: `/${testPort}`, kit }, {})
      await delay(100)

      const client = await connect(testPort)
      const response = await sendMsg(client, { type: 'get', id: '1', path: '/test' })

      expect(response.type).toBe('response')
      expect(response.id).toBe('1')
      expect(response.result.body.message).toBe('hello')
    })

    it('proxies PUT messages to kit', async () => {
      let receivedBody = null
      const kit = resource({
        get: async () => ({ headers: {}, body: null }),
        put: async (h, b) => {
          receivedBody = b
          return { headers: {}, body: { received: true } }
        },
      })

      await wsServer.put({ path: `/${testPort}`, kit }, {})
      await delay(100)

      const client = await connect(testPort)
      const response = await sendMsg(client, {
        type: 'put',
        id: '1',
        path: '/test',
        body: { data: 'test' },
      })

      expect(response.result.body.received).toBe(true)
      expect(receivedBody).toEqual({ data: 'test' })
    })

    it('handles invalid JSON message', async () => {
      const kit = createMockKit()
      await wsServer.put({ path: `/${testPort}`, kit }, {})
      await delay(100)

      const client = await connect(testPort)

      const response = await new Promise(resolve => {
        client.once('message', data => resolve(JSON.parse(data.toString())))
        client.send('{ invalid json }')
      })

      expect(response.type).toBe('error')
    })
  })

  describe('broadcast', () => {
    it('broadcasts message to all clients', async () => {
      const kit = createMockKit()
      await wsServer.put({ path: `/${testPort}`, kit }, {})
      await delay(100)

      const client1 = await connect(testPort)
      const client2 = await connect(testPort)

      const received = { c1: null, c2: null }
      // Use once to avoid listener accumulation
      client1.once('message', data => {
        received.c1 = JSON.parse(data.toString())
      })
      client2.once('message', data => {
        received.c2 = JSON.parse(data.toString())
      })

      const result = await wsServer.put({ path: `/${testPort}/broadcast` }, { hello: 'world' })

      await delay(100) // Allow messages to arrive

      expect(result.body.sent).toBe(2)
      expect(received.c1.type).toBe('broadcast')
      expect(received.c1.body.hello).toBe('world')
      expect(received.c2.body.hello).toBe('world')
    })

    it('returns not-found when broadcasting to unknown server', async () => {
      const result = await wsServer.put({ path: '/99999/broadcast' }, {})

      expect(result.headers.condition).toBe('not-found')
    })
  })

  describe('client tracking', () => {
    it('tracks connected clients', async () => {
      const kit = createMockKit()
      await wsServer.put({ path: `/${testPort}`, kit }, {})
      await delay(100)

      await connect(testPort)
      await connect(testPort)

      const status = await wsServer.get({ path: `/${testPort}` })
      expect(status.body.clients).toBe(2)
    })

    it('removes disconnected clients', async () => {
      const kit = createMockKit()
      await wsServer.put({ path: `/${testPort}`, kit }, {})
      await delay(100)

      const client1 = await connect(testPort)
      await connect(testPort)

      let status = await wsServer.get({ path: `/${testPort}` })
      expect(status.body.clients).toBe(2)

      client1.close()
      await delay(100)

      status = await wsServer.get({ path: `/${testPort}` })
      expect(status.body.clients).toBe(1)
    })
  })

  describe('chaos testing - degraded backends', () => {
    it('handles slow backend responses', async () => {
      const slowKit = resource({
        get: async () => {
          await delay(100)
          return { headers: {}, body: { slow: true } }
        },
        put: async () => ({ headers: {}, body: null }),
      })

      await wsServer.put({ path: `/${testPort}`, kit: slowKit }, {})
      await delay(100)

      const client = await connect(testPort)

      const start = Date.now()
      const response = await sendMsg(client, { type: 'get', id: '1', path: '/test' })
      const elapsed = Date.now() - start

      expect(response.result.body.slow).toBe(true)
      expect(elapsed).toBeGreaterThanOrEqual(100)
    })

    it('handles backend that throws errors', async () => {
      const errorKit = resource({
        get: async () => {
          throw new Error('Backend exploded')
        },
        put: async () => ({ headers: {}, body: null }),
      })

      await wsServer.put({ path: `/${testPort}`, kit: errorKit }, {})
      await delay(100)

      const client = await connect(testPort)
      const response = await sendMsg(client, { type: 'get', id: '1', path: '/test' })

      // Kit is wrapped by resource() which catches errors via safe()
      // So error is returned as condition in the result, not as WS error
      expect(response.type).toBe('response')
      expect(response.result.headers.condition).toBe('error')
      expect(response.result.headers.message).toContain('Backend exploded')
    })

    it('handles randomly failing backend', async () => {
      let callCount = 0
      const flakyKit = resource({
        get: async () => {
          callCount++
          if (callCount % 2 === 0) {
            throw new Error('Random failure')
          }
          return { headers: {}, body: { success: true } }
        },
        put: async () => ({ headers: {}, body: null }),
      })

      await wsServer.put({ path: `/${testPort}`, kit: flakyKit }, {})
      await delay(100)

      const client = await connect(testPort)

      const results = await Promise.all([
        sendMsg(client, { type: 'get', id: '1', path: '/test' }),
        sendMsg(client, { type: 'get', id: '2', path: '/test' }),
        sendMsg(client, { type: 'get', id: '3', path: '/test' }),
        sendMsg(client, { type: 'get', id: '4', path: '/test' }),
      ])

      // All return as 'response', but some have error conditions in result
      const successes = results.filter(r => r.result?.body?.success === true)
      const errors = results.filter(r => r.result?.headers?.condition === 'error')

      expect(successes.length).toBeGreaterThan(0)
      expect(errors.length).toBeGreaterThan(0)
    })

    it('handles high message volume', async () => {
      let receivedCount = 0
      const counterKit = resource({
        get: async () => {
          receivedCount++
          return { headers: {}, body: { count: receivedCount } }
        },
        put: async () => ({ headers: {}, body: null }),
      })

      await wsServer.put({ path: `/${testPort}`, kit: counterKit }, {})
      await delay(100)

      const client = await connect(testPort)

      // Fire 20 messages rapidly
      const promises = Array.from({ length: 20 }, (_, i) => sendMsg(client, { type: 'get', id: `${i}`, path: '/test' }))

      const results = await Promise.all(promises)

      expect(results.length).toBe(20)
      expect(receivedCount).toBe(20)
    })
  })

  describe('edge cases', () => {
    it('handles deeply nested paths', async () => {
      let receivedPath = null
      const kit = resource({
        get: async h => {
          receivedPath = h.path
          return { headers: {}, body: {} }
        },
        put: async () => ({ headers: {}, body: null }),
      })

      await wsServer.put({ path: `/${testPort}`, kit }, {})
      await delay(100)

      const client = await connect(testPort)
      await sendMsg(client, { type: 'get', id: '1', path: '/a/b/c/d/e/f' })

      expect(receivedPath).toBe('/a/b/c/d/e/f')
    })

    it('server stop closes all clients', async () => {
      const kit = createMockKit()
      await wsServer.put({ path: `/${testPort}`, kit }, {})
      await delay(100)

      const clients = await Promise.all([connect(testPort), connect(testPort), connect(testPort)])

      const closedPromises = clients.map(c => new Promise(resolve => c.once('close', resolve)))

      await wsServer.put({ path: `/${testPort}/stop` })
      await Promise.all(closedPromises)

      // All clients should be closed
      expect(clients.every(c => c.readyState === WebSocket.CLOSED)).toBe(true)
    })
  })
})

// Helpers

function createMockKit(returnValue = {}) {
  return resource({
    get: async () => ({ headers: {}, body: returnValue }),
    put: async () => ({ headers: {}, body: returnValue }),
  })
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
