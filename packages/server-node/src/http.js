import { createServer } from 'node:http'
import { routes } from '@bassline/core'

/**
 * Create HTTP server routes
 * Servers are resources at `bl:///server/http/:port`
 *
 * @returns {import('@bassline/core').RouterBuilder}
 *
 * @example
 * const bl = new Bassline()
 * bl.install(createHttpServerRoutes())
 *
 * // Start server
 * await bl.put('bl:///server/http/8080', {}, {})
 *
 * // Query status
 * await bl.get('bl:///server/http/8080')
 * // → { headers: { type: 'bl:///types/server' }, body: { port: 8080, status: 'running' } }
 */
export function createHttpServerRoutes() {
  /** @type {Map<number, {server: import('http').Server, config: object, connections: Set<import('net').Socket>, startTime: number}>} */
  const servers = new Map()

  return routes('/server/http', r => {
    // List all HTTP servers
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: [...servers.entries()].map(([port, s]) => ({
          name: String(port),
          type: 'server',
          uri: `bl:///server/http/${port}`,
          status: s.server.listening ? 'running' : 'stopped'
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
            status: s.server.listening ? 'running' : 'stopped',
            connections: s.connections.size,
            uptime: Date.now() - s.startTime,
            config: s.config
          }
        }
      },

      put: ({ params, body, bl }) => {
        const port = parseInt(params.port)

        // Stop existing server if any
        if (servers.has(port)) {
          const existing = servers.get(port)
          existing.server.close()
          existing.connections.forEach(conn => conn.destroy())
        }

        const connections = new Set()
        const startTime = Date.now()

        const server = createServer(async (req, res) => {
          try {
            // Parse URI from query string or path
            const reqUrl = new URL(req.url, `http://localhost:${port}`)
            const uri = reqUrl.searchParams.get('uri') || `bl://${reqUrl.pathname}${reqUrl.search}`

            // Extract peer identifier from header for trust/capability checks
            const headers = {}
            if (req.headers['x-bassline-peer']) {
              headers.peer = req.headers['x-bassline-peer']
            }

            if (req.method === 'GET') {
              const result = await bl.get(uri, headers)
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(result))
            } else if (req.method === 'PUT' || req.method === 'POST') {
              let data = ''
              req.on('data', chunk => data += chunk)
              req.on('end', async () => {
                try {
                  const reqBody = data ? JSON.parse(data) : undefined
                  const result = await bl.put(uri, headers, reqBody)
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
        servers.set(port, { server, config: body, connections, startTime })

        return {
          headers: { type: 'bl:///types/server' },
          body: { port, status: 'running', config: body }
        }
      }
    })
  })
}
