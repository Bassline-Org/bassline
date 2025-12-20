import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRemote } from '../src/index.js'

describe('createRemote', () => {
  let remote
  const mockServers = new Map()

  beforeEach(() => {
    // Create a mock WebSocket that simulates server behavior
    class MockWebSocket {
      constructor(uri) {
        this.uri = uri
        this.readyState = 0 // CONNECTING
        this.onopen = null
        this.onclose = null
        this.onmessage = null
        this.onerror = null
        this._messages = []

        // Get or create mock server for this URI
        let server = mockServers.get(uri)
        if (!server) {
          server = createMockServer()
          mockServers.set(uri, server)
        }
        this._server = server

        // Simulate async connection
        setTimeout(() => {
          if (!this._forceFail) {
            this.readyState = 1 // OPEN
            this.onopen?.()
          }
        }, 10)
      }

      send(data) {
        const msg = JSON.parse(data)
        this._server.handleMessage(this, msg)
      }

      close() {
        this.readyState = 3 // CLOSED
        this.onclose?.()
      }

      // Test helper to inject errors
      simulateError() {
        this._forceFail = true
        this.readyState = 3
        this.onerror?.()
        this.onclose?.()
      }
    }

    MockWebSocket.CONNECTING = 0
    MockWebSocket.OPEN = 1
    MockWebSocket.CLOSING = 2
    MockWebSocket.CLOSED = 3

    remote = createRemote({ WebSocket: MockWebSocket })
    mockServers.clear()
  })

  afterEach(() => {
    mockServers.clear()
  })

  describe('connection directory', () => {
    it('lists connections at root', async () => {
      const result = await remote.get({ path: '/' })

      expect(result.headers.type).toBe('/types/bassline')
      expect(result.body.name).toBe('remote')
      expect(result.body.resources).toEqual({})
    })

    it('lists active connections', async () => {
      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })
      await remote.put({ path: '/server2' }, { uri: 'ws://localhost:9112' })

      const result = await remote.get({ path: '/' })

      expect(result.body.resources).toHaveProperty('/server1')
      expect(result.body.resources).toHaveProperty('/server2')
    })

    it('shows connection status', async () => {
      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })

      // Initially connecting
      let result = await remote.get({ path: '/' })
      expect(result.body.resources['/server1'].status).toBe('connecting')

      // After connection establishes
      await delay(20)
      result = await remote.get({ path: '/' })
      expect(result.body.resources['/server1'].status).toBe('connected')
    })
  })

  describe('connection lifecycle', () => {
    it('creates connection on PUT', async () => {
      const result = await remote.put({ path: '/myserver' }, { uri: 'ws://localhost:9111' })

      expect(result.headers.type).toBe('/types/remote-connection')
      expect(result.body.name).toBe('myserver')
      expect(result.body.uri).toBe('ws://localhost:9111')
      expect(result.body.status).toBe('connecting')
    })

    it('gets connection status', async () => {
      await remote.put({ path: '/myserver' }, { uri: 'ws://localhost:9111' })
      await delay(20) // Wait for connection

      const result = await remote.get({ path: '/myserver' })

      expect(result.headers.type).toBe('/types/remote-connection')
      expect(result.body.status).toBe('connected')
    })

    it('returns not-found for unknown connection', async () => {
      const result = await remote.get({ path: '/unknown' })

      expect(result.headers.condition).toBe('not-found')
    })

    it('closes connection', async () => {
      await remote.put({ path: '/myserver' }, { uri: 'ws://localhost:9111' })
      await delay(20)

      const result = await remote.put({ path: '/myserver/close' })

      expect(result.body.status).toBe('closed')

      // Should be gone from list
      const list = await remote.get({ path: '/' })
      expect(list.body.resources).not.toHaveProperty('/myserver')
    })

    it('returns error when closing unknown connection', async () => {
      const result = await remote.put({ path: '/nonexistent/close' })

      // Close checks if connection exists and returns not-found
      // But looking at implementation, it just calls ws.close() which may throw
      // Actually the close route does check and returns not-found
      expect(result.headers.condition).toBe('not-found')
    })

    it('replaces existing connection on second PUT', async () => {
      await remote.put({ path: '/myserver' }, { uri: 'ws://localhost:9111' })
      await delay(20)

      await remote.put({ path: '/myserver' }, { uri: 'ws://localhost:9112' })

      const status = await remote.get({ path: '/myserver' })
      expect(status.body.uri).toBe('ws://localhost:9112')
    })
  })

  describe('request proxying', () => {
    it('proxies GET requests', async () => {
      const server = createMockServer({
        get: { '/test': { data: 'from remote' } },
      })
      mockServers.set('ws://localhost:9111', server)

      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })
      await delay(20)

      const result = await remote.get({ path: '/server1/proxy/test' })

      expect(result.body.data).toBe('from remote')
    })

    it('proxies PUT requests', async () => {
      const server = createMockServer()
      let receivedBody = null
      server.onPut = (path, body) => {
        receivedBody = body
        return { headers: {}, body: { received: true } }
      }
      mockServers.set('ws://localhost:9111', server)

      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })
      await delay(20)

      const result = await remote.put({ path: '/server1/proxy/test' }, { mydata: 'value' })

      expect(result.body.received).toBe(true)
      expect(receivedBody).toEqual({ mydata: 'value' })
    })

    it('handles nested paths', async () => {
      const server = createMockServer({
        get: { '/a/b/c/d': { nested: true } },
      })
      mockServers.set('ws://localhost:9111', server)

      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })
      await delay(20)

      const result = await remote.get({ path: '/server1/proxy/a/b/c/d' })

      expect(result.body.nested).toBe(true)
    })

    it('returns not-found when proxying to unknown connection', async () => {
      const result = await remote.get({ path: '/unknown/proxy/test' })

      expect(result.headers.condition).toBe('not-found')
    })

    it('queues requests until connection is ready', async () => {
      const server = createMockServer({
        get: { '/test': { queued: true } },
      })
      mockServers.set('ws://localhost:9111', server)

      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })

      // Send request immediately (before connection is ready)
      const resultPromise = remote.get({ path: '/server1/proxy/test' })

      // Wait for connection and response
      await delay(20)
      const result = await resultPromise

      expect(result.body.queued).toBe(true)
    })
  })

  describe('multiple connections', () => {
    it('maintains independent connections', async () => {
      const server1 = createMockServer({ get: { '/test': { server: 1 } } })
      const server2 = createMockServer({ get: { '/test': { server: 2 } } })
      mockServers.set('ws://localhost:9111', server1)
      mockServers.set('ws://localhost:9112', server2)

      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })
      await remote.put({ path: '/server2' }, { uri: 'ws://localhost:9112' })
      await delay(20)

      const [result1, result2] = await Promise.all([
        remote.get({ path: '/server1/proxy/test' }),
        remote.get({ path: '/server2/proxy/test' }),
      ])

      expect(result1.body.server).toBe(1)
      expect(result2.body.server).toBe(2)
    })

    it('closing one connection does not affect others', async () => {
      const server1 = createMockServer({ get: { '/test': { server: 1 } } })
      const server2 = createMockServer({ get: { '/test': { server: 2 } } })
      mockServers.set('ws://localhost:9111', server1)
      mockServers.set('ws://localhost:9112', server2)

      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })
      await remote.put({ path: '/server2' }, { uri: 'ws://localhost:9112' })
      await delay(20)

      await remote.put({ path: '/server1/close' })

      const result2 = await remote.get({ path: '/server2/proxy/test' })
      expect(result2.body.server).toBe(2)
    })
  })

  describe('concurrent requests', () => {
    it('handles multiple concurrent requests', async () => {
      const server = createMockServer({
        get: {
          '/a': { letter: 'a' },
          '/b': { letter: 'b' },
          '/c': { letter: 'c' },
        },
      })
      mockServers.set('ws://localhost:9111', server)

      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })
      await delay(20)

      const results = await Promise.all([
        remote.get({ path: '/server1/proxy/a' }),
        remote.get({ path: '/server1/proxy/b' }),
        remote.get({ path: '/server1/proxy/c' }),
      ])

      expect(results.map(r => r.body.letter)).toEqual(['a', 'b', 'c'])
    })

    it('maintains request-response correlation', async () => {
      let requestCount = 0
      const server = createMockServer()
      server.onGet = path => {
        requestCount++
        return { headers: {}, body: { requestNum: requestCount, path } }
      }
      mockServers.set('ws://localhost:9111', server)

      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })
      await delay(20)

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) => remote.get({ path: `/server1/proxy/path${i}` }))
      )

      // Each result should have its corresponding path
      results.forEach((result, i) => {
        expect(result.body.path).toBe(`/path${i}`)
      })
    })
  })

  describe('error handling', () => {
    it('handles server error responses', async () => {
      const server = createMockServer()
      server.onGet = () => ({
        headers: { condition: 'error', message: 'Server error' },
        body: null,
      })
      mockServers.set('ws://localhost:9111', server)

      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })
      await delay(20)

      const result = await remote.get({ path: '/server1/proxy/test' })

      expect(result.headers.condition).toBe('error')
    })

    it('handles not-found responses from server', async () => {
      const server = createMockServer()
      server.onGet = () => ({
        headers: { condition: 'not-found' },
        body: null,
      })
      mockServers.set('ws://localhost:9111', server)

      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })
      await delay(20)

      const result = await remote.get({ path: '/server1/proxy/nonexistent' })

      expect(result.headers.condition).toBe('not-found')
    })
  })

  describe('message protocol', () => {
    it('sends correct GET message format', async () => {
      const server = createMockServer()
      let receivedMessage = null
      server.rawHandler = (ws, msg) => {
        receivedMessage = msg
        ws.onmessage({ data: JSON.stringify({ type: 'response', id: msg.id, result: { headers: {}, body: {} } }) })
      }
      mockServers.set('ws://localhost:9111', server)

      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })
      await delay(20)

      await remote.get({ path: '/server1/proxy/test' })

      expect(receivedMessage.type).toBe('get')
      expect(receivedMessage.path).toBe('/test')
      expect(receivedMessage.id).toBeDefined()
    })

    it('sends correct PUT message format', async () => {
      const server = createMockServer()
      let receivedMessage = null
      server.rawHandler = (ws, msg) => {
        receivedMessage = msg
        ws.onmessage({ data: JSON.stringify({ type: 'response', id: msg.id, result: { headers: {}, body: {} } }) })
      }
      mockServers.set('ws://localhost:9111', server)

      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })
      await delay(20)

      await remote.put({ path: '/server1/proxy/test' }, { data: 'value' })

      expect(receivedMessage.type).toBe('put')
      expect(receivedMessage.path).toBe('/test')
      expect(receivedMessage.body).toEqual({ data: 'value' })
    })

    it('increments message IDs', async () => {
      const server = createMockServer()
      const receivedIds = []
      server.rawHandler = (ws, msg) => {
        receivedIds.push(msg.id)
        ws.onmessage({ data: JSON.stringify({ type: 'response', id: msg.id, result: { headers: {}, body: {} } }) })
      }
      mockServers.set('ws://localhost:9111', server)

      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })
      await delay(20)

      await remote.get({ path: '/server1/proxy/a' })
      await remote.get({ path: '/server1/proxy/b' })
      await remote.get({ path: '/server1/proxy/c' })

      expect(receivedIds).toEqual([1, 2, 3])
    })
  })

  describe('edge cases', () => {
    it('handles path at proxy level', async () => {
      const server = createMockServer({ get: { '/data': { atProxy: true } } })
      mockServers.set('ws://localhost:9111', server)

      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })
      await delay(20)

      const result = await remote.get({ path: '/server1/proxy/data' })

      expect(result.body.atProxy).toBe(true)
    })

    it('handles special characters in path', async () => {
      const server = createMockServer({ get: { '/path with spaces': { special: true } } })
      mockServers.set('ws://localhost:9111', server)

      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })
      await delay(20)

      const result = await remote.get({ path: '/server1/proxy/path with spaces' })

      expect(result.body.special).toBe(true)
    })

    it('handles large response bodies', async () => {
      const largeData = { data: 'x'.repeat(10000) }
      const server = createMockServer({ get: { '/large': largeData } })
      mockServers.set('ws://localhost:9111', server)

      await remote.put({ path: '/server1' }, { uri: 'ws://localhost:9111' })
      await delay(20)

      const result = await remote.get({ path: '/server1/proxy/large' })

      expect(result.body.data.length).toBe(10000)
    })
  })
})

// Helpers

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function createMockServer(routes = {}) {
  const server = {
    routes: {
      get: routes.get || {},
      put: routes.put || {},
    },
    onGet: null,
    onPut: null,
    rawHandler: null,

    handleMessage(ws, msg) {
      if (server.rawHandler) {
        server.rawHandler(ws, msg)
        return
      }

      let result
      if (msg.type === 'get') {
        if (server.onGet) {
          result = server.onGet(msg.path)
        } else {
          const data = server.routes.get[msg.path]
          result = data ? { headers: {}, body: data } : { headers: { condition: 'not-found' }, body: null }
        }
      } else if (msg.type === 'put') {
        if (server.onPut) {
          result = server.onPut(msg.path, msg.body)
        } else {
          result = { headers: {}, body: { received: true } }
        }
      }

      ws.onmessage({ data: JSON.stringify({ type: 'response', id: msg.id, result }) })
    },
  }

  return server
}
