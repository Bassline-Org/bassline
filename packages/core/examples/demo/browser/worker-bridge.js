import { fromPort } from '/src/transports/worker.js'
import { fromWebSocket } from '/src/transports/websocket.js'

const [portRead, portWrite] = fromPort(self)
const [wsRead, wsWrite] = fromWebSocket(new WebSocket('ws://localhost:3000'))

// bridge: port → ws, ws → port
portRead.sink(msg => wsWrite.send(msg))
wsRead.sink(msg => portWrite.send(msg))
