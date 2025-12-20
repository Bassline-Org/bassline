import { resource, routes, bind } from '@bassline/core'

/**
 * Create remote WebSocket client resource
 *
 * Routes:
 * GET  /                → list connections
 * GET  /:name           → connection status
 * PUT  /:name           → create connection
 * PUT  /:name/close     → close connection
 * GET  /:name/proxy/:path* → proxy GET to remote
 * PUT  /:name/proxy/:path* → proxy PUT to remote
 *
 * Unlike the old API that dynamically registered routes at mount points,
 * this version uses an explicit /proxy sub-resource. Users access remote
 * resources via: /remote/server1/proxy/data/users/alice
 * @param {object} options
 * @param {typeof WebSocket} [options.WebSocket] - WebSocket constructor
 */
export function createRemote(options = {}) {
  const WS = options.WebSocket || globalThis.WebSocket
  const connections = new Map()

  function createConnection(name, config) {
    const ws = new WS(config.uri)
    const pending = new Map()
    let nextId = 1
    let ready = false
    const queue = []

    ws.onopen = () => {
      ready = true
      queue.forEach(fn => fn())
      queue.length = 0
    }

    ws.onmessage = event => {
      const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString())
      if (msg.type === 'response') {
        const resolver = pending.get(msg.id)
        if (resolver) {
          pending.delete(msg.id)
          resolver(msg.result)
        }
      }
    }

    ws.onerror = () => {
      ready = false
    }
    ws.onclose = () => {
      ready = false
    }

    return {
      ws,
      config,
      pending,
      nextId: () => nextId++,
      ready: () => ready,
      queue,
    }
  }

  function sendRequest(conn, msg) {
    return new Promise(resolve => {
      const id = conn.nextId()
      conn.pending.set(id, resolve)
      const payload = JSON.stringify({ ...msg, id })
      if (conn.ready()) {
        conn.ws.send(payload)
      } else {
        conn.queue.push(() => conn.ws.send(payload))
      }
    })
  }

  return routes({
    '': resource({
      get: async () => ({
        headers: { type: '/types/bassline' },
        body: {
          name: 'remote',
          description: 'WebSocket remote connections',
          resources: Object.fromEntries(
            [...connections.entries()].map(([name, conn]) => [
              `/${name}`,
              { uri: conn.config.uri, status: conn.ready() ? 'connected' : 'connecting' },
            ])
          ),
        },
      }),
    }),

    unknown: bind(
      'name',
      routes({
        '': resource({
          get: async h => {
            const conn = connections.get(h.params.name)
            if (!conn) return { headers: { condition: 'not-found' }, body: null }

            return {
              headers: { type: '/types/remote-connection' },
              body: {
                name: h.params.name,
                uri: conn.config.uri,
                status: conn.ready() ? 'connected' : 'connecting',
              },
            }
          },

          put: async (h, body) => {
            // Close existing connection if any
            const existing = connections.get(h.params.name)
            if (existing) {
              existing.ws.close()
            }

            const conn = createConnection(h.params.name, body)
            connections.set(h.params.name, conn)

            return {
              headers: { type: '/types/remote-connection' },
              body: {
                name: h.params.name,
                uri: body.uri,
                status: 'connecting',
              },
            }
          },
        }),

        close: resource({
          put: async h => {
            const conn = connections.get(h.params.name)
            if (!conn) return { headers: { condition: 'not-found' }, body: null }

            conn.ws.close()
            connections.delete(h.params.name)

            return {
              headers: {},
              body: { name: h.params.name, status: 'closed' },
            }
          },
        }),

        proxy: bind(
          'proxyPath',
          resource({
            get: async h => {
              const conn = connections.get(h.params.name)
              if (!conn) return { headers: { condition: 'not-found' }, body: null }

              // Reconstruct the full path from segment + remaining path
              const fullPath = h.params.proxyPath + (h.path && h.path !== '/' ? h.path : '')
              return sendRequest(conn, { type: 'get', path: '/' + fullPath })
            },

            put: async (h, body) => {
              const conn = connections.get(h.params.name)
              if (!conn) return { headers: { condition: 'not-found' }, body: null }

              const fullPath = h.params.proxyPath + (h.path && h.path !== '/' ? h.path : '')
              return sendRequest(conn, { type: 'put', path: '/' + fullPath, body })
            },
          })
        ),
      })
    ),
  })
}

export default createRemote
