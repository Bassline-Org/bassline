import net from 'node:net'
import { fromSocket } from '../transports/socket.js'
import { channel } from '../channel.js'

export function serve(options = {}) {
  const [r, w] = channel()
  const server = net.createServer(socket => {
    w.send(fromSocket(socket))
  })
  server.listen(options)
  server.on('close', w.close)
  server.on('error', w.err)
  return [r, server]
}
