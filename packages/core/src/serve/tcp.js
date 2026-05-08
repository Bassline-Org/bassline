// [[file:../../book/v2.org::*Serving (TCP)][Serving (TCP):1]]
import nodeNet from 'node:net'
import { fromSocket } from '../transports/socket.js'
import { msg } from '../bassline.js'
import defaultFrame from '../frame/jsonl.js'

const description = `\
I am a server.
I handle incoming connections as ports.`

export function serve(onConnect, options = {}, frame = defaultFrame) {
  const m = msg().merge({ description, options })

  const server = nodeNet.createServer(socket => {
    const [client, recv] = fromSocket(socket, frame)
    client.closedBy(m)
    onConnect([client, recv])
  })

  m.grantCaps({ close: m.close }).closes(server)

  server.listen(options)
  server.on('close', m.close)
  server.on('error', m.close)

  return [m, server]
}
// Serving (TCP):1 ends here
