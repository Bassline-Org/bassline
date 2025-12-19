import { createServer } from 'node:http'
import { resource, routes, bind } from '@bassline/core'

/**
 * Create HTTP server resource
 *
 * Routes:
 *   GET  /           → list all servers (bassline)
 *   GET  /:port      → get server status
 *   PUT  /:port      → start server (uses kit to proxy requests)
 *   PUT  /:port/stop → stop server
 */
export const createHttpServer = () => {
  const servers = new Map()

  return routes({
    '': resource({
      get: async () => ({
        headers: { type: '/types/bassline' },
        body: {
          name: 'http-servers',
          description: 'HTTP servers that proxy to bassline',
          resources: Object.fromEntries(
            [...servers.keys()].map(port => [`/${port}`, { status: servers.get(port).listening ? 'running' : 'stopped' }])
          )
        }
      })
    }),

    unknown: bind('port', routes({
      '': resource({
        get: async (h) => {
          const port = parseInt(h.params.port)
          const entry = servers.get(port)
          if (!entry) return { headers: { status: 404 }, body: null }

          return {
            headers: { type: '/types/http-server' },
            body: {
              port,
              status: entry.server.listening ? 'running' : 'stopped',
              connections: entry.connections.size,
              uptime: Date.now() - entry.startTime
            }
          }
        },

        put: async (h, body) => {
          const port = parseInt(h.params.port)
          const kit = h.kit

          // Stop existing server if any
          const existing = servers.get(port)
          if (existing) {
            existing.server.close()
            existing.connections.forEach(conn => conn.destroy())
          }

          const connections = new Set()
          const startTime = Date.now()

          const server = createServer(async (req, res) => {
            try {
              const reqUrl = new URL(req.url, `http://localhost:${port}`)
              const path = reqUrl.searchParams.get('path') || reqUrl.pathname

              const headers = {}
              if (req.headers['x-bassline-peer']) {
                headers.peer = req.headers['x-bassline-peer']
              }

              if (req.method === 'GET') {
                // Proxy GET to kit
                const result = kit
                  ? await kit.get({ path, ...headers })
                  : { headers: { status: 500 }, body: { error: 'no kit' } }
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(result))
              } else if (req.method === 'PUT' || req.method === 'POST') {
                let data = ''
                req.on('data', chunk => data += chunk)
                req.on('end', async () => {
                  try {
                    const reqBody = data ? JSON.parse(data) : undefined
                    // Proxy PUT to kit
                    const result = kit
                      ? await kit.put({ path, ...headers }, reqBody)
                      : { headers: { status: 500 }, body: { error: 'no kit' } }
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify(result))
                  } catch (err) {
                    res.statusCode = 400
                    res.end(JSON.stringify({ error: err.message }))
                  }
                })
              } else {
                res.statusCode = 405
                res.end(JSON.stringify({ error: 'Method not allowed' }))
              }
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
            }
          })

          server.on('connection', conn => {
            connections.add(conn)
            conn.on('close', () => connections.delete(conn))
          })

          server.listen(port)
          servers.set(port, { server, connections, startTime, kit })

          return {
            headers: { type: '/types/http-server' },
            body: { port, status: 'running' }
          }
        }
      }),

      stop: resource({
        put: async (h) => {
          const port = parseInt(h.params.port)
          const entry = servers.get(port)
          if (!entry) return { headers: { status: 404 }, body: null }

          entry.server.close()
          entry.connections.forEach(conn => conn.destroy())
          servers.delete(port)

          return { headers: {}, body: { port, status: 'stopped' } }
        }
      })
    }))
  })
}

export default createHttpServer
