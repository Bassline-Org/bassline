import { fromWebSocket } from '../transports/websocket.js'
import { msg } from '../bassline.js'

const description = `\
I am a web socket server.
I behave similar to a normal server,
but over web sockets. Go figure!`

export function serve(wss, onConnect) {
  const m = msg({ description })
  m.ctl.closes(wss)
  wss.on('connection', ws => {
    const [client, recv] = fromWebSocket(ws)
    m.ctl.closes(client)
    onConnect([client, recv])
  })
  const close = () => m.close()
  m.grant('close', close)
  wss.on('close', close)
  wss.on('error', close)

  return [m, wss]
}
