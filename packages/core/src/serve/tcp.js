import nodeNet from 'node:net'
import { fromSocket } from '../transports/socket.js'
import { msg } from '../bassline.js'
import defaultFrame from '../frame/jsonl.js'

const description = `\
I am a server.
I handle incoming connections as ports.`

export function serve(onConnect, options = {}, frame = defaultFrame) {
  const m = msg({ description, options })

  const server = nodeNet.createServer(socket => {
    const [client, recv] = fromSocket(socket, frame)
    m.closes(client)
    onConnect([client, recv])
  })

  m.closes(server)
  server.listen(options)

  m.grant('close', m.close)
  server.on('close', m.close)
  server.on('error', m.close)

  return [m, server]
}
