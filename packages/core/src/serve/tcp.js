import nodeNet from 'node:net'
import { fromSocket } from '../transports/socket.js'
import { port } from '../bassline.js'
import defaultFrame from '../frame/jsonl.js'

export function serve(options = {}, frame = defaultFrame) {
  const p = port()
  const { recv, close, ctl } = p
  const server = nodeNet.createServer(socket => {
    const clientPort = fromSocket(socket, frame)
    ctl.closes(clientPort)
    p.send(clientPort)
  })

  ctl.closes(server)
  server.listen(options)
  server.on('close', close)
  server.on('error', close)
  return { connections: recv, recv, server, close, ctl }
}
