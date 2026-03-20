import { fromWebSocket } from '../transports/websocket.js'
import { port } from '../comm.js'

export function serve(wss) {
  const p = port()
  wss.on('connection', ws => p.send(fromWebSocket(ws)))
  wss.on('close', () => p.close())
  wss.on('error', () => p.close())
  return { recv: p.recv, close: () => p.close(), wss }
}
