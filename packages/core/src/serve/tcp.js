import nodeNet from 'node:net'
import { fromSocket } from '../transports/socket.js'
import { port, createController } from '../bassline.js'
import defaultFrame from '../frame/jsonl.js'

export function serve(options = {}, frame = defaultFrame) {
  const { ctl, close } = createController()
  const p = port()
  const server = nodeNet.createServer(socket => {
    const clientPort = fromSocket(socket, frame)
    ctl.closes(clientPort)
    p.send(clientPort)
  })

  ctl.closes(server, p)
  server.listen(options)
  server.on('close', close)
  server.on('error', close)
  return { connections: p.recv, recv: p.recv, server, close, ctl }
}
