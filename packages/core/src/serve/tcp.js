import nodeNet from 'node:net'
import { fromSocket } from '../transports/socket.js'
import { port } from '../bassline.js'

export function serve(options = {}, frame) {
  const p = port()
  const server = nodeNet.createServer(socket => {
    p.send(fromSocket(socket, frame))
  })
  server.listen(options)
  server.on('close', () => p.close())
  server.on('error', () => p.close())
  return {
    recv: p.recv,
    close: () => {
      p.close()
      server.close()
    },
    server,
  }
}
