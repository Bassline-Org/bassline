import { createServer } from 'node:http'
import { Bassline } from '@bassline/core'
import { FileStore } from '@bassline/store-node'

const DATA_DIR = process.env.BL_DATA || '.bassline'
const PORT = process.env.BL_PORT || 9111

const bl = new Bassline()
bl.mount('/', new FileStore(DATA_DIR))

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const uri = url.searchParams.get('uri')

  if (req.method === 'GET') {
    const resource = bl.resolve(uri)
    if (!resource) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(resource.get()))
  } else if (req.method === 'PUT') {
    let body = ''
    req.on('data', c => body += c)
    req.on('end', () => {
      const store = bl.storeFor(uri)
      store.save(uri, JSON.parse(body))
      res.end('OK')
    })
  } else {
    res.writeHead(405)
    res.end('Method not allowed')
  }
}).listen(PORT, () => {
  console.log(`Bassline daemon listening on port ${PORT}`)
  console.log(`Data directory: ${DATA_DIR}`)
})
