import { fromWebSocket } from '../transports/websocket.js'
import { msg } from '../bassline.js'

const description = `\
I am a web socket server.
I behave similar to a normal server,
but over web sockets. Go figure!`

export function serve(wss, onConnect) {
  const m = msg({ description })
  m.closes(wss)
  wss.on('connection', ws => {
    const [client, recv] = fromWebSocket(ws)
    m.closes(client)
    onConnect([client, recv])
  })
  m.grant('close', m.close)
  wss.on('close', m.close)
  wss.on('error', m.close)

  return [m, wss]
}
