import { WebSocketServer } from 'ws'
import { serve as serveTcp } from '../../src/serve/tcp.js'
import { serve as serveWs } from '../../src/serve/ws.js'
import { merge } from '../../src/channel.js'
import fs from 'node:fs'

const sock = '/tmp/bl-demo.sock'
try {
  fs.unlinkSync(sock)
} catch (e) {
  console.log('failed to unlink socket: ', e)
}

const wss = new WebSocketServer({ port: 3000 })
const [tcpConns, tcpServer] = serveTcp({ path: sock })
const [wsConns] = serveWs(wss)
const allConns = merge([tcpConns, wsConns])

const clients = new Map()

console.log('ws  : ws://localhost:3000')
console.log('tcp : ' + sock)
console.log('---')

process.on('SIGINT', () => {
  tcpServer.close()
  wss.close()
  process.exit()
})

function broadcast(msg) {
  for (const w of clients.keys()) w.send(msg)
}

await allConns.sink(([read, write]) => {
  clients.set(write, null)
  console.log(`+ connection (${clients.size} total)`)
  read
    .sink(msg => {
      if (msg.from && !clients.get(write)) {
        clients.set(write, msg.from)
        const join = { from: 'server', body: `${msg.from} has joined`, ts: Date.now() }
        console.log('reflect:', join)
        broadcast(join)
      }
      const reflected = { ...msg, via: 'server', ts: Date.now() }
      console.log('reflect:', reflected)
      broadcast(reflected)
    })
    .then(() => {
      const id = clients.get(write)
      clients.delete(write)
      console.log(`- connection (${clients.size} total)`)
      if (id) {
        const leave = { from: 'server', body: `${id} has left`, ts: Date.now() }
        console.log('reflect:', leave)
        broadcast(leave)
      }
    })
})
