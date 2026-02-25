import { createServer } from 'node:http'

export default function http(platform) {
  platform.serve = (opts = {}) => {
    const port = opts.port || parseInt(process.env.PORT || '3000')
    const root = platform.root

    const server = createServer(async (req, res) => {
      const path = new URL(req.url, 'http://localhost').pathname
      const segments = path.split('/').filter(Boolean)

      try {
        let msg
        const raw = req.headers['x-bl']
        try {
          msg = raw ? JSON.parse(raw) : {}
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'malformed X-Bl header' }))
          return
        }

        if (req.method === 'PUT' || req.method === 'POST') {
          msg.put = await readBody(req)
        } else if (req.method !== 'GET') {
          res.writeHead(405).end()
          return
        }

        let result
        if (segments.length === 0) {
          result = root(msg)
        } else {
          const target = root({ walk: segments })
          result = typeof target === 'function' ? target(msg) : target
        }

        if (result instanceof Promise) result = await result

        if (typeof result === 'function') {
          result = result({})
          if (result instanceof Promise) result = await result
        }

        // Scope listings return { hrefs: [...names] } — enrich with full paths
        if (result && Array.isArray(result.hrefs)) {
          const base = path.endsWith('/') ? path : path + '/'
          result = { hrefs: result.hrefs.map(name => ({ name, href: base + name })) }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result ?? null))
      } catch (e) {
        const code = e.status || (e.message?.includes('not found') ? 404 : 500)
        res.writeHead(code, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
    })

    const close = () => {
      process.removeListener('SIGTERM', onSignal)
      process.removeListener('SIGINT', onSignal)
      return new Promise(resolve => {
        platform.announce('server.stopping', { port })
        server.close(() => {
          platform.announce('server.stopped', { port })
          resolve()
        })
      })
    }

    const onSignal = () => close().then(() => process.exit(0))
    process.on('SIGTERM', onSignal)
    process.on('SIGINT', onSignal)

    server.listen(port, () => platform.announce('server.started', { port }))
    return { server, close }
  }
}

const MAX_BODY = 100 * 1024 * 1024 // 100 MB

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => {
      data += chunk
      if (data.length > MAX_BODY) {
        req.destroy()
        reject(Object.assign(new Error('body too large'), { status: 413 }))
      }
    })
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : undefined) }
      catch { resolve(data) }
    })
    req.on('error', reject)
  })
}
