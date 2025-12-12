import { WebSocketServer } from 'ws'
import { resource } from '@bassline/core'

/**
 * Create WebSocket server routes
 * Servers are resources at `bl:///server/ws/:port`
 *
 * @param {object} plumber - Plumber instance for message routing
 * @returns {object} Resource with routes and install method
 *
 * @example
 * const bl = new Bassline()
 * const plumber = createPlumber()
 * plumber.install(bl)
 * bl.mount('/server/ws', createWsServerRoutes(plumber))
 *
 * // Start server
 * await bl.put('bl:///server/ws/9000', {}, {})
 *
 * // Query status
 * await bl.get('bl:///server/ws/9000')
 * // → { headers: { type: 'bl:///types/server' }, body: { port: 9000, clients: 0 } }
 */
export function createWsServerRoutes(plumber) {
  /** @type {Map<number, {wss: WebSocketServer, clients: Set<WebSocket>, startTime: number}>} */
  const servers = new Map()

  const wsResource = resource(r => {
    // List all WebSocket servers
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: [...servers.entries()].map(([port, s]) => ({
          name: String(port),
          type: 'server',
          uri: `bl:///server/ws/${port}`,
          clients: s.clients.size
        }))
      }
    }))

    r.route('/:port', {
      get: ({ params }) => {
        const port = parseInt(params.port)
        const s = servers.get(port)
        if (!s) return null

        return {
          headers: { type: 'bl:///types/server' },
          body: {
            port,
            clients: s.clients.size,
            uptime: Date.now() - s.startTime
          }
        }
      },

      put: ({ params, body, bl }) => {
        const port = parseInt(params.port)

        // Close existing server if any
        if (servers.has(port)) {
          const existing = servers.get(port)
          existing.clients.forEach(ws => ws.close())
          existing.wss.close()
        }

        const clients = new Set()
        const startTime = Date.now()
        const wss = new WebSocketServer({ port })

        wss.on('connection', (ws) => {
          clients.add(ws)
          /** @type {Map<string, function>} */
          const unlistens = new Map()

          ws.on('message', async (data) => {
            try {
              const msg = JSON.parse(data.toString())

              if (msg.type === 'get') {
                const result = await bl.get(msg.uri, msg.headers || {})
                ws.send(JSON.stringify({ type: 'response', id: msg.id, result }))
              }

              if (msg.type === 'put') {
                const result = await bl.put(msg.uri, msg.headers || {}, msg.body)
                ws.send(JSON.stringify({ type: 'response', id: msg.id, result }))
              }

              if (msg.type === 'listen' && plumber) {
                const unlisten = plumber.listen(msg.port, (message) => {
                  ws.send(JSON.stringify({ type: 'message', port: msg.port, message }))
                })
                unlistens.set(msg.port, unlisten)
                ws.send(JSON.stringify({ type: 'response', id: msg.id, result: { ok: true } }))
              }

              if (msg.type === 'unlisten') {
                const unlisten = unlistens.get(msg.port)
                if (unlisten) {
                  unlisten()
                  unlistens.delete(msg.port)
                }
                ws.send(JSON.stringify({ type: 'response', id: msg.id, result: { ok: true } }))
              }
            } catch (err) {
              ws.send(JSON.stringify({ type: 'error', error: err.message }))
            }
          })

          ws.on('close', () => {
            clients.delete(ws)
            unlistens.forEach(fn => fn())
          })

          ws.on('error', () => {
            clients.delete(ws)
            unlistens.forEach(fn => fn())
          })
        })

        servers.set(port, { wss, clients, startTime })

        return {
          headers: { type: 'bl:///types/server' },
          body: { port, status: 'running' }
        }
      }
    })
  })

  /**
   * Install WebSocket server routes into a Bassline instance
   * @param {import('@bassline/core').Bassline} bl
   * @param {object} [options] - Options
   * @param {string} [options.prefix='/server/ws'] - Mount prefix
   */
  wsResource.install = (bl, { prefix = '/server/ws' } = {}) => {
    bl.mount(prefix, wsResource)
  }

  return wsResource
}
