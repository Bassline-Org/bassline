import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join, extname } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }

createServer((req, res) => {
  const path = req.url === '/' ? '/demo/index.html' : req.url
  try {
    const data = readFileSync(join(root, path))
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'text/plain' })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
}).listen(3333, () => console.log('http://localhost:3333'))
