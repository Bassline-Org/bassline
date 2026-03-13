import { fromWebSocket } from '../transports/websocket.js'
import { channel } from '../channel.js'

export function serve(wss) {
  const [r, w] = channel()
  wss.on('connection', ws => w.send(fromWebSocket(ws)))
  wss.on('close', () => w.close())
  wss.on('error', e => w.err(e))
  return [r, wss]
}
