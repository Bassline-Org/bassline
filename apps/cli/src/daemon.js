import { createServer } from 'node:http'
import { Bassline } from '@bassline/core'
import { createFileStore } from '@bassline/store-node'

const DATA_DIR = process.env.BL_DATA || '.bassline'
const PORT = process.env.BL_PORT || 9111

const bl = new Bassline()

// Install file store - handles /data/:path*
bl.install(createFileStore(DATA_DIR, '/data'))

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const uri = url.searchParams.get('uri')

  if (!uri) {
    res.writeHead(400)
    res.end(JSON.stringify({ error: 'Missing uri parameter' }))
    return
  }

  try {
    if (req.method === 'GET') {
      const result = await bl.get(uri)
      if (!result) {
        res.writeHead(404)
        res.end(JSON.stringify({ error: 'Not found', uri }))
        return
      }
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result))
    } else if (req.method === 'PUT') {
      let body = ''
      req.on('data', c => body += c)
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body)
          const result = await bl.put(uri, {}, parsed)
          if (!result) {
            res.writeHead(404)
            res.end(JSON.stringify({ error: 'No route for PUT', uri }))
            return
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result))
        } catch (err) {
          res.writeHead(400)
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    } else {
      res.writeHead(405)
      res.end('Method not allowed')
    }
  } catch (err) {
    res.writeHead(500)
    res.end(JSON.stringify({ error: err.message }))
  }
}).listen(PORT, () => {
  console.log(`Bassline daemon listening on port ${PORT}`)
  console.log(`Data directory: ${DATA_DIR}`)
  console.log(`\nEndpoints:`)
  console.log(`  GET  http://localhost:${PORT}?uri=bl:///data`)
  console.log(`  PUT  http://localhost:${PORT}?uri=bl:///data/path/to/doc`)
})
