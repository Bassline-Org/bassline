import { resource } from '@bassline/core'

/**
 * Create routes for managing WebSocket remote connections
 *
 * @param {object} [options]
 * @param {typeof WebSocket} [options.WebSocket] - WebSocket constructor (defaults to global WebSocket)
 * @returns {object} Resource with routes and install method
 *
 * @example
 * const bl = new Bassline()
 * bl.mount('/remote/ws', createRemoteRoutes())
 *
 * // Create a remote connection that mounts at /server1
 * await bl.put('bl:///remote/ws/server1', {}, {
 *   uri: 'ws://localhost:9000',
 *   mount: '/server1'
 * })
 *
 * // Now access remote resources directly
 * await bl.get('bl:///server1/data/users/alice')
 * // Proxies to bl:///data/users/alice on the remote server
 *
 * // Inspect connection status
 * await bl.get('bl:///remote/ws/server1')
 * // → { headers: { type: 'bl:///types/remote' }, body: { status: 'connected', uri: '...', mount: '...' } }
 */
export function createRemoteRoutes(options = {}) {
  const WS = options.WebSocket || WebSocket
  const connections = new Map() // name -> { ws, config, pending, nextId, ready, queue }

  function createConnection(name, config, bl) {
    const ws = new WS(config.uri)
    const pending = new Map()
    let nextId = 1
    let ready = false
    const queue = []

    ws.onopen = () => {
      ready = true
      queue.forEach((fn) => fn())
      queue.length = 0
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
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

    const conn = { ws, config, pending, nextId: () => nextId++, ready: () => ready, queue }

    // Register routes for this mount point
    // Root route (e.g., bl:///local → bl:///)
    bl.route(`${config.mount}`, {
      get: async () => {
        return sendRequest(conn, { type: 'get', uri: 'bl:///' })
      },
      put: async ({ body }) => {
        return sendRequest(conn, { type: 'put', uri: 'bl:///', body })
      },
    })

    // Sub-path routes (e.g., bl:///local/data → bl:///data)
    bl.route(`${config.mount}/:path*`, {
      get: async ({ params }) => {
        const remoteUri = `bl:///${params.path}`
        return sendRequest(conn, { type: 'get', uri: remoteUri })
      },
      put: async ({ params, body }) => {
        const remoteUri = `bl:///${params.path}`
        return sendRequest(conn, { type: 'put', uri: remoteUri, body })
      },
    })

    return conn
  }

  function sendRequest(conn, msg) {
    return new Promise((resolve) => {
      const id = conn.nextId()
      conn.pending.set(id, (result) => {
        // Rewrite URIs in the response to include the mount prefix
        resolve(rewriteUris(result, conn.config.mount))
      })
      const payload = JSON.stringify({ ...msg, id })
      if (conn.ready()) {
        conn.ws.send(payload)
      } else {
        conn.queue.push(() => conn.ws.send(payload))
      }
    })
  }

  /**
   * Recursively rewrite bl:/// URIs in a response to include mount prefix
   * e.g. bl:///data/foo → bl:///local/data/foo when mount is /local
   */
  function rewriteUris(obj, mount) {
    if (obj === null || obj === undefined) return obj

    if (typeof obj === 'string') {
      // Rewrite bl:/// URIs to include mount
      if (obj.startsWith('bl:///')) {
        const path = obj.slice(6) // Remove 'bl:///'
        return `bl://${mount}/${path}`
      }
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => rewriteUris(item, mount))
    }

    if (typeof obj === 'object') {
      const result = {}
      for (const [key, value] of Object.entries(obj)) {
        result[key] = rewriteUris(value, mount)
      }
      return result
    }

    return obj
  }

  const remoteResource = resource((r) => {
    // List all remote connections
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: [...connections.entries()].map(([name, conn]) => ({
          name,
          type: 'remote',
          uri: `bl:///remote/ws/${name}`,
          status: conn.ready() ? 'connected' : 'connecting',
        })),
      },
    }))

    // Get/put individual connections
    r.route('/:name', {
      get: ({ params }) => {
        const conn = connections.get(params.name)
        if (!conn) return null

        return {
          headers: { type: 'bl:///types/remote' },
          body: {
            status: conn.ready() ? 'connected' : 'connecting',
            uri: conn.config.uri,
            mount: conn.config.mount,
          },
        }
      },

      put: ({ params, body, bl }) => {
        const name = params.name

        // Close existing connection if any
        if (connections.has(name)) {
          connections.get(name).ws.close()
        }

        // Create new connection
        const conn = createConnection(name, body, bl)
        connections.set(name, conn)

        return {
          headers: { type: 'bl:///types/remote' },
          body: {
            status: 'connecting',
            uri: body.uri,
            mount: body.mount,
          },
        }
      },
    })
  })

  /**
   * Install remote routes into a Bassline instance
   * @param {import('@bassline/core').Bassline} bl
   * @param {object} [opts] - Options
   * @param {string} [opts.prefix='/remote/ws'] - Mount prefix
   */
  remoteResource.install = (bl, { prefix = '/remote/ws' } = {}) => {
    bl.mount(prefix, remoteResource)
  }

  return remoteResource
}
