import { fromWebSocket } from '../transports/websocket.js'
import { channel } from '../channel.js'

export function serve(wss) {
  const [connections, connectionsWriter] = channel()
  wss.on('connection', ws => connectionsWriter.send(fromWebSocket(ws)))
  wss.on('close', connectionsWriter.close)
  wss.on('error', connectionsWriter.err)
  return [connections, wss]
}
