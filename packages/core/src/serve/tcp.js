import net from 'node:net'
import { fromSocket } from '../transports/socket.js'
import { channel } from '../channel.js'

export function serve(options = {}, frame) {
  const [connections, connectionsWriter] = channel()
  const server = net.createServer(socket => {
    connectionsWriter.send(fromSocket(socket, frame))
  })
  server.listen(options)
  server.on('close', connectionsWriter.close)
  server.on('error', connectionsWriter.err)
  return [connections, server]
}
