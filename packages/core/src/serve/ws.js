import { fromWebSocket } from '../transports/websocket.js'
import { port } from '../bassline.js'

export function serve(wss) {
  const { send, ctl, close, recv } = port()
  wss.on('connection', ws => {
    const client = fromWebSocket(ws)
    ctl.closes(client)
    send(client)
  })
  wss.on('close', close)
  wss.on('error', close)
  return { recv, wss, ctl, close }
}
