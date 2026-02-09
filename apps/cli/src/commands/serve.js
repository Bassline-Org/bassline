import { createServer } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { log, info, item } from '../log.js'

export async function command(options) {
  const port = parseInt(options.port, 10) || 2017
  const baseDir = join(process.cwd(), 'public', 'r')

  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method !== 'GET') {
      res.writeHead(405)
      res.end()
      return
    }

    const url = new URL(req.url, `http://localhost:${port}`)
    const pathname = url.pathname.replace(/^\//, '')

    // Reject path traversal
    if (pathname.includes('..')) {
      res.writeHead(400)
      res.end()
      return
    }

    // Serve index at root — prefer index.json, fall back to directory listing
    if (!pathname || pathname === '/') {
      try {
        const indexContent = await readFile(join(baseDir, 'index.json'), 'utf-8')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(indexContent)
      } catch {
        try {
          const files = await readdir(baseDir)
          const items = files
            .filter(f => f.endsWith('.json') && f !== 'index.json')
            .map(f => f.replace('.json', ''))
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ items }))
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ items: [] }))
        }
      }
      return
    }

    // Serve item JSON
    const name = pathname.endsWith('.json') ? pathname : `${pathname}.json`
    try {
      const content = await readFile(join(baseDir, name), 'utf-8')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(content)
    } catch {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'not found' }))
    }
  })

  server.listen(port, () => {
    info(`Serving registry items from public/r/`)
    log(`http://localhost:${port}/`)
    log()
    info('Consumers can add this registry:')
    item(`bl registry add @yourname http://localhost:${port}`)
  })
}
