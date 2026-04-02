import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function graphApi(graphsDir) {
  return {
    name: 'graph-api',
    configureServer(server) {
      if (!existsSync(graphsDir)) mkdirSync(graphsDir, { recursive: true })

      server.middlewares.use((req, res, next) => {
        if (!req.url.startsWith('/api/graphs')) return next()

        const name = req.url.replace('/api/graphs', '').replace(/^\//, '')
        const json = (status = 200) => {
          res.setHeader('Content-Type', 'application/json')
          res.statusCode = status
        }

        // GET /api/graphs — list
        if (req.method === 'GET' && !name) {
          json()
          const files = readdirSync(graphsDir)
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''))
          return res.end(JSON.stringify(files))
        }

        // GET /api/graphs/:name — load
        if (req.method === 'GET' && name) {
          const file = join(graphsDir, `${name}.json`)
          if (!existsSync(file)) {
            json(404)
            return res.end(JSON.stringify({ error: 'not found' }))
          }
          json()
          return res.end(readFileSync(file, 'utf8'))
        }

        // PUT /api/graphs/:name — save
        if (req.method === 'PUT' && name) {
          let body = ''
          req.on('data', chunk => (body += chunk))
          req.on('end', () => {
            writeFileSync(join(graphsDir, `${name}.json`), body)
            json()
            res.end(JSON.stringify({ ok: true }))
          })
          return
        }

        // DELETE /api/graphs/:name — delete
        if (req.method === 'DELETE' && name) {
          const file = join(graphsDir, `${name}.json`)
          if (existsSync(file)) unlinkSync(file)
          json()
          return res.end(JSON.stringify({ ok: true }))
        }

        next()
      })
    },
  }
}
