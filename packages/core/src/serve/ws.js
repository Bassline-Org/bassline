// [[file:../../book/v2.org::*Serving (WebSocket)][Serving (WebSocket):1]]
import { fromWebSocket } from '../transports/websocket.js'
import { msg } from '../bassline.js'

const description = `\
I am a web socket server.
I behave similar to a normal server,
but over web sockets. Go figure!`

export function serve(wss, onConnect) {
  const m = msg().merge({ description }).closes(wss)

  wss.on('connection', ws => {
    const [client, recv] = fromWebSocket(ws)
    client.closedBy(m)
    onConnect([client, recv])
  })

  m.grantCaps({ close: m.close })
  wss.on('close', m.close)
  wss.on('error', m.close)

  return [m, wss]
}
// Serving (WebSocket):1 ends here
