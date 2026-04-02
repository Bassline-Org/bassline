import { defineConfig } from 'vite'
import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const graphsDir = new URL('./graphs', import.meta.url).pathname

export default defineConfig({
  plugins: [
    {
      name: 'graph-api',
      configureServer(server) {
        if (!existsSync(graphsDir)) mkdirSync(graphsDir, { recursive: true })

        server.middlewares.use((req, res, next) => {
          if (!req.url.startsWith('/api/graphs')) return next()

          const name = req.url.replace('/api/graphs', '').replace(/^\//, '')
          const json = type => {
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = type === 404 ? 404 : 200
          }

          // GET /api/graphs
          // lists graphs
          if (req.method === 'GET' && !name) {
            json()
            const files = readdirSync(graphsDir)
              .filter(f => f.endsWith('.json'))
              .map(f => f.replace('.json', ''))
            return res.end(JSON.stringify(files))
          }

          // GET /api/graphs/:name
          // load a graph
          if (req.method === 'GET' && name) {
            const file = join(graphsDir, `${name}.json`)
            if (!existsSync(file)) {
              json(404)
              return res.end(JSON.stringify({ error: 'not found' }))
            }
            json()
            return res.end(readFileSync(file, 'utf8'))
          }

          // PUT /api/graphs/:name
          // save graph
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

          // DELETE /api/graphs/:name
          // delete graph
          if (req.method === 'DELETE' && name) {
            const file = join(graphsDir, `${name}.json`)
            if (existsSync(file)) unlinkSync(file)
            json()
            return res.end(JSON.stringify({ ok: true }))
          }

          next()
        })
      },
    },
  ],
})
