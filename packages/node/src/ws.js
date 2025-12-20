import { WebSocketServer } from 'ws'
import { resource, routes, bind } from '@bassline/core'

/**
 * Create WebSocket server resource
 *
 * Routes:
 *   GET  /           → list all servers (bassline)
 *   GET  /:port      → get server status
 *   PUT  /:port      → start server (uses kit to proxy requests)
 *   PUT  /:port/stop → stop server
 *
 * WebSocket protocol:
 *   Client sends: { type: 'get'|'put', id, path, body? }
 *   Server sends: { type: 'response', id, result }
 */
export const createWsServer = () => {
  const servers = new Map()

  return routes({
    '': resource({
      get: async () => ({
        headers: { type: '/types/bassline' },
        body: {
          name: 'ws-servers',
          description: 'WebSocket servers that proxy to bassline',
          resources: Object.fromEntries(
            [...servers.keys()].map(port => [`/${port}`, { clients: servers.get(port).clients.size }])
          ),
        },
      }),
    }),

    unknown: bind(
      'port',
      routes({
        '': resource({
          get: async h => {
            const port = parseInt(h.params.port)
            const entry = servers.get(port)
            if (!entry) return { headers: { condition: 'not-found' }, body: null }

            return {
              headers: { type: '/types/ws-server' },
              body: {
                port,
                clients: entry.clients.size,
                uptime: Date.now() - entry.startTime,
              },
            }
          },

          put: async (h, _body) => {
            const port = parseInt(h.params.port)
            const kit = h.kit

            // Close existing server if any
            const existing = servers.get(port)
            if (existing) {
              existing.clients.forEach(ws => ws.close())
              existing.wss.close()
            }

            const clients = new Set()
            const startTime = Date.now()
            const wss = new WebSocketServer({ port })

            wss.on('connection', ws => {
              clients.add(ws)

              ws.on('message', async data => {
                try {
                  const msg = JSON.parse(data.toString())

                  if (msg.type === 'get' && kit) {
                    const result = await kit.get({ path: msg.path, ...msg.headers })
                    ws.send(JSON.stringify({ type: 'response', id: msg.id, result }))
                  }

                  if (msg.type === 'put' && kit) {
                    const result = await kit.put({ path: msg.path, ...msg.headers }, msg.body)
                    ws.send(JSON.stringify({ type: 'response', id: msg.id, result }))
                  }
                } catch (err) {
                  ws.send(JSON.stringify({ type: 'error', error: err.message }))
                }
              })

              ws.on('close', () => clients.delete(ws))
              ws.on('error', () => clients.delete(ws))
            })

            servers.set(port, { wss, clients, startTime, kit })

            return {
              headers: { type: '/types/ws-server' },
              body: { port, status: 'running' },
            }
          },
        }),

        stop: resource({
          put: async h => {
            const port = parseInt(h.params.port)
            const entry = servers.get(port)
            if (!entry) return { headers: { condition: 'not-found' }, body: null }

            entry.clients.forEach(ws => ws.close())
            entry.wss.close()
            servers.delete(port)

            return { headers: {}, body: { port, status: 'stopped' } }
          },
        }),

        broadcast: resource({
          put: async (h, body) => {
            const port = parseInt(h.params.port)
            const entry = servers.get(port)
            if (!entry) return { headers: { condition: 'not-found' }, body: null }

            const msg = JSON.stringify({ type: 'broadcast', body })
            entry.clients.forEach(ws => ws.send(msg))

            return { headers: {}, body: { sent: entry.clients.size } }
          },
        }),
      })
    ),
  })
}

export default createWsServer
