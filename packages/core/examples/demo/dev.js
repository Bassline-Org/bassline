import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const mimeTypes = { '.html': 'text/html', '.js': 'application/javascript' }

http
  .createServer((req, res) => {
    const filePath = req.url.startsWith('/src/')
      ? path.join(__dirname, '../../src', req.url.slice(4))
      : path.join(__dirname, 'browser', req.url === '/' ? '/index.html' : req.url)
    const stream = fs.createReadStream(filePath)
    stream.on('open', () => {
      res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'text/plain' })
      stream.pipe(res)
    })
    stream.on('error', () => {
      res.writeHead(404)
      res.end('not found')
    })
  })
  .listen(8080, () => console.log('http://localhost:8080'))
