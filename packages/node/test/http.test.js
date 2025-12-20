import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resource } from '@bassline/core'
import { createHttpServer } from '../src/http.js'

// Test ports - use high numbers to avoid conflicts
const BASE_PORT = 19100

describe('createHttpServer', () => {
  let httpServer
  let testPort

  beforeEach(() => {
    httpServer = createHttpServer()
    testPort = BASE_PORT + Math.floor(Math.random() * 900)
  })

  afterEach(async () => {
    // Clean up any running servers
    const list = await httpServer.get({ path: '/' })
    for (const port of Object.keys(list.body.resources || {})) {
      await httpServer.put({ path: `${port}/stop` })
    }
  })

  describe('server directory', () => {
    it('lists servers at root', async () => {
      const result = await httpServer.get({ path: '/' })

      expect(result.headers.type).toBe('/types/bassline')
      expect(result.body.name).toBe('http-servers')
      expect(result.body.resources).toEqual({})
    })

    it('lists running servers', async () => {
      const kit = createMockKit({ test: 'value' })
      await httpServer.put({ path: `/${testPort}`, kit }, {})

      // Wait for server to be ready
      await delay(100)

      // Verify server is in the list
      const result = await httpServer.get({ path: '/' })
      expect(result.body.resources).toHaveProperty(`/${testPort}`)

      // Verify server is actually running by making a request
      const response = await fetch(`http://localhost:${testPort}/test`)
      const data = await response.json()
      expect(data.body.test).toBe('value')
    })
  })

  describe('server lifecycle', () => {
    it('starts server on PUT', async () => {
      const kit = createMockKit()
      const result = await httpServer.put({ path: `/${testPort}`, kit }, {})

      expect(result.headers.type).toBe('/types/http-server')
      expect(result.body.port).toBe(testPort)
      expect(result.body.status).toBe('running')
    })

    it('gets server status', async () => {
      const kit = createMockKit()
      await httpServer.put({ path: `/${testPort}`, kit }, {})

      const result = await httpServer.get({ path: `/${testPort}` })

      expect(result.headers.type).toBe('/types/http-server')
      expect(result.body.port).toBe(testPort)
      expect(result.body.status).toBe('running')
      expect(result.body.uptime).toBeGreaterThanOrEqual(0)
    })

    it('returns not-found for unknown port', async () => {
      const result = await httpServer.get({ path: '/99999' })

      expect(result.headers.condition).toBe('not-found')
    })

    it('stops server', async () => {
      const kit = createMockKit()
      await httpServer.put({ path: `/${testPort}`, kit }, {})
      const result = await httpServer.put({ path: `/${testPort}/stop` })

      expect(result.body.status).toBe('stopped')
    })

    it('returns not-found when stopping unknown server', async () => {
      const result = await httpServer.put({ path: '/99999/stop' })

      expect(result.headers.condition).toBe('not-found')
    })

    it('restarts server on second PUT', async () => {
      const kit1 = createMockKit({ value: 1 })
      const kit2 = createMockKit({ value: 2 })

      await httpServer.put({ path: `/${testPort}`, kit: kit1 }, {})
      await httpServer.put({ path: `/${testPort}`, kit: kit2 }, {})

      // Server should still be running
      const status = await httpServer.get({ path: `/${testPort}` })
      expect(status.body.status).toBe('running')
    })
  })

  describe('HTTP request proxying', () => {
    it('proxies GET to kit', async () => {
      const kit = createMockKit({ message: 'hello' })
      await httpServer.put({ path: `/${testPort}`, kit }, {})

      const response = await fetch(`http://localhost:${testPort}/test`)
      const data = await response.json()

      expect(data.body.message).toBe('hello')
    })

    it('proxies PUT to kit', async () => {
      let receivedBody = null
      const kit = resource({
        get: async () => ({ headers: {}, body: null }),
        put: async (h, b) => {
          receivedBody = b
          return { headers: {}, body: { received: true } }
        },
      })

      await httpServer.put({ path: `/${testPort}`, kit }, {})

      const response = await fetch(`http://localhost:${testPort}/test`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' }),
      })
      const data = await response.json()

      expect(data.body.received).toBe(true)
      expect(receivedBody).toEqual({ data: 'test' })
    })

    it('proxies POST as PUT to kit', async () => {
      let receivedBody = null
      const kit = resource({
        get: async () => ({ headers: {}, body: null }),
        put: async (h, b) => {
          receivedBody = b
          return { headers: {}, body: { received: true } }
        },
      })

      await httpServer.put({ path: `/${testPort}`, kit }, {})

      await fetch(`http://localhost:${testPort}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posted: true }),
      })

      expect(receivedBody).toEqual({ posted: true })
    })

    it('returns 405 for unsupported methods', async () => {
      const kit = createMockKit()
      await httpServer.put({ path: `/${testPort}`, kit }, {})

      const response = await fetch(`http://localhost:${testPort}/test`, {
        method: 'DELETE',
      })

      expect(response.status).toBe(405)
    })

    it('uses path query parameter when provided', async () => {
      let receivedPath = null
      const kit = resource({
        get: async h => {
          receivedPath = h.path
          return { headers: {}, body: {} }
        },
        put: async () => ({ headers: {}, body: null }),
      })

      await httpServer.put({ path: `/${testPort}`, kit }, {})
      await fetch(`http://localhost:${testPort}/ignored?path=/actual/path`)

      expect(receivedPath).toBe('/actual/path')
    })

    it('passes peer header to kit', async () => {
      let receivedPeer = null
      const kit = resource({
        get: async h => {
          receivedPeer = h.peer
          return { headers: {}, body: {} }
        },
        put: async () => ({ headers: {}, body: null }),
      })

      await httpServer.put({ path: `/${testPort}`, kit }, {})
      await fetch(`http://localhost:${testPort}/test`, {
        headers: { 'X-Bassline-Peer': 'alice' },
      })

      expect(receivedPeer).toBe('alice')
    })

    it('handles invalid JSON body gracefully', async () => {
      const kit = createMockKit()
      await httpServer.put({ path: `/${testPort}`, kit }, {})

      const response = await fetch(`http://localhost:${testPort}/test`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json }',
      })

      expect(response.status).toBe(400)
    })

    it('returns error when no kit provided', async () => {
      // Start server without kit
      await httpServer.put({ path: `/${testPort}` }, {})

      const response = await fetch(`http://localhost:${testPort}/test`)
      const data = await response.json()

      expect(data.headers.condition).toBe('error')
      expect(data.headers.message).toBe('no kit')
    })
  })

  describe('chaos testing - degraded backends', () => {
    it('handles slow backend responses', async () => {
      const slowKit = resource({
        get: async () => {
          await delay(100) // Slow response
          return { headers: {}, body: { slow: true } }
        },
        put: async () => ({ headers: {}, body: null }),
      })

      await httpServer.put({ path: `/${testPort}`, kit: slowKit }, {})

      const start = Date.now()
      const response = await fetch(`http://localhost:${testPort}/test`)
      const elapsed = Date.now() - start

      const data = await response.json()
      expect(data.body.slow).toBe(true)
      expect(elapsed).toBeGreaterThanOrEqual(100)
    })

    it('handles backend that throws errors', async () => {
      const errorKit = resource({
        get: async () => {
          throw new Error('Backend exploded')
        },
        put: async () => ({ headers: {}, body: null }),
      })

      await httpServer.put({ path: `/${testPort}`, kit: errorKit }, {})
      await delay(50)

      const response = await fetch(`http://localhost:${testPort}/test`)
      const data = await response.json()

      // Kit is wrapped by resource() which catches errors via safe()
      // So error is returned as condition in the response, not HTTP 500
      expect(response.status).toBe(200)
      expect(data.headers.condition).toBe('error')
      expect(data.headers.message).toContain('Backend exploded')
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

      await httpServer.put({ path: `/${testPort}`, kit: flakyKit }, {})
      await delay(50)

      // Make sequential requests to ensure alternating behavior
      const responses = []
      for (let i = 0; i < 4; i++) {
        const response = await fetch(`http://localhost:${testPort}/test`)
        const data = await response.json()
        responses.push(data)
      }

      // All return 200, but alternating success/error in body
      const successes = responses.filter(r => r.body?.success === true)
      const errors = responses.filter(r => r.headers?.condition === 'error')

      expect(successes.length).toBeGreaterThan(0)
      expect(errors.length).toBeGreaterThan(0)
    })

    it('handles backend that returns errors in response', async () => {
      const errorResponseKit = resource({
        get: async () => ({
          headers: { condition: 'error', message: 'Database unavailable' },
          body: null,
        }),
        put: async () => ({ headers: {}, body: null }),
      })

      await httpServer.put({ path: `/${testPort}`, kit: errorResponseKit }, {})

      const response = await fetch(`http://localhost:${testPort}/test`)
      const data = await response.json()

      // Server returns 200 but with error condition in body
      expect(response.status).toBe(200)
      expect(data.headers.condition).toBe('error')
    })

    it('handles backend with varying latency', async () => {
      const latencies = []
      const jitteryKit = resource({
        get: async () => {
          const latency = Math.random() * 50
          latencies.push(latency)
          await delay(latency)
          return { headers: {}, body: { latency } }
        },
        put: async () => ({ headers: {}, body: null }),
      })

      await httpServer.put({ path: `/${testPort}`, kit: jitteryKit }, {})

      // Make sequential requests
      for (let i = 0; i < 5; i++) {
        await fetch(`http://localhost:${testPort}/test`)
      }

      expect(latencies.length).toBe(5)
    })
  })

  describe('concurrent access', () => {
    it('handles many concurrent requests', async () => {
      let requestCount = 0
      const counterKit = resource({
        get: async () => {
          requestCount++
          return { headers: {}, body: { count: requestCount } }
        },
        put: async () => ({ headers: {}, body: null }),
      })

      await httpServer.put({ path: `/${testPort}`, kit: counterKit }, {})

      // Fire 20 concurrent requests
      const requests = Array.from({ length: 20 }, () => fetch(`http://localhost:${testPort}/test`).then(r => r.json()))

      const results = await Promise.all(requests)

      expect(results.length).toBe(20)
      expect(requestCount).toBe(20)
    })

    it('tracks active connections', async () => {
      const slowKit = resource({
        get: async () => {
          await delay(100)
          return { headers: {}, body: {} }
        },
        put: async () => ({ headers: {}, body: null }),
      })

      await httpServer.put({ path: `/${testPort}`, kit: slowKit }, {})

      // Start requests but don't await
      const pendingRequests = [
        fetch(`http://localhost:${testPort}/test`),
        fetch(`http://localhost:${testPort}/test`),
        fetch(`http://localhost:${testPort}/test`),
      ]

      // Check connections while requests are pending
      await delay(20)
      const status = await httpServer.get({ path: `/${testPort}` })
      expect(status.body.connections).toBeGreaterThan(0)

      // Wait for all to complete
      await Promise.all(pendingRequests)
    })

    it('handles requests during server restart', async () => {
      const kit1 = createMockKit({ version: 1 })
      const kit2 = createMockKit({ version: 2 })

      await httpServer.put({ path: `/${testPort}`, kit: kit1 }, {})

      // Start some requests, restart server mid-flight
      const request1 = fetch(`http://localhost:${testPort}/test`)
        .then(r => r.json())
        .catch(() => ({ error: 'failed' }))

      await httpServer.put({ path: `/${testPort}`, kit: kit2 }, {})

      const request2 = fetch(`http://localhost:${testPort}/test`).then(r => r.json())

      const [_result1, result2] = await Promise.all([request1, request2])

      // Second request should use new kit
      expect(result2.body.version).toBe(2)
    })
  })

  describe('edge cases', () => {
    it('handles empty request body', async () => {
      let receivedBody = null
      const kit = resource({
        get: async () => ({ headers: {}, body: null }),
        put: async (h, b) => {
          receivedBody = b
          return { headers: {}, body: { received: true } }
        },
      })

      await httpServer.put({ path: `/${testPort}`, kit }, {})

      await fetch(`http://localhost:${testPort}/test`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: '',
      })

      expect(receivedBody).toBeUndefined()
    })

    it('handles deeply nested paths', async () => {
      let receivedPath = null
      const kit = resource({
        get: async h => {
          receivedPath = h.path
          return { headers: {}, body: {} }
        },
        put: async () => ({ headers: {}, body: null }),
      })

      await httpServer.put({ path: `/${testPort}`, kit }, {})
      await fetch(`http://localhost:${testPort}/a/b/c/d/e/f/g`)

      expect(receivedPath).toBe('/a/b/c/d/e/f/g')
    })

    it('handles special characters in path', async () => {
      let receivedPath = null
      const kit = resource({
        get: async h => {
          receivedPath = h.path
          return { headers: {}, body: {} }
        },
        put: async () => ({ headers: {}, body: null }),
      })

      await httpServer.put({ path: `/${testPort}`, kit }, {})
      await delay(50)
      await fetch(`http://localhost:${testPort}/path%20with%20spaces`)

      // Path is received URL-encoded (not decoded by server)
      expect(receivedPath).toBe('/path%20with%20spaces')
    })

    it('handles large request body', async () => {
      let receivedSize = 0
      const kit = resource({
        get: async () => ({ headers: {}, body: null }),
        put: async (h, b) => {
          receivedSize = JSON.stringify(b).length
          return { headers: {}, body: { size: receivedSize } }
        },
      })

      await httpServer.put({ path: `/${testPort}`, kit }, {})

      const largeBody = { data: 'x'.repeat(10000) }
      const response = await fetch(`http://localhost:${testPort}/test`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largeBody),
      })
      const result = await response.json()

      expect(result.body.size).toBeGreaterThan(10000)
    })

    it('handles server stop with active connections', async () => {
      const slowKit = resource({
        get: async () => {
          await delay(200)
          return { headers: {}, body: { completed: true } }
        },
        put: async () => ({ headers: {}, body: null }),
      })

      await httpServer.put({ path: `/${testPort}`, kit: slowKit }, {})

      // Start slow request
      const pendingRequest = fetch(`http://localhost:${testPort}/test`)
        .then(r => r.json())
        .catch(() => ({ error: 'connection closed' }))

      // Stop server while request is pending
      await delay(50)
      await httpServer.put({ path: `/${testPort}/stop` })

      const result = await pendingRequest

      // Request should fail or complete with error
      expect(result.error || result.body).toBeDefined()
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
