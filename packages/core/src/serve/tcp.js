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
    m.ctl.closes(client)
    onConnect([client, recv])
  })

  m.ctl.closes(server)
  server.listen(options)

  const close = () => m.close()
  server.on('close', close)
  server.on('error', close)

  return [m, server]
}
