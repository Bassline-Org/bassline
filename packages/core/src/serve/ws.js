import { fromWebSocket } from '../transports/websocket.js'
import { port, createController } from '../bassline.js'

export function serve(wss) {
  const { ctl, close } = createController()
  const p = port()
  ctl.closes(p, wss)
  wss.on('connection', ws => {
    const client = fromWebSocket(ws)
    ctl.closes(client)
    p.send(client)
  })
  wss.on('close', close)
  wss.on('error', close)
  return { recv: p.recv, wss, ctl, close }
}
