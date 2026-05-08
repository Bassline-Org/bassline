// [[file:../../book/v2.org::*WebSocket][WebSocket:1]]
import { port, msg } from '../bassline.js'

const description = `I am a web socket.`

export function fromWebSocket(ws) {
  const outgoing = msg().merge({ description })
  const [msgs, recv] = port()
  ws.addEventListener('message', e => {
    try {
      msgs.send(msg().merge(JSON.parse(e.data)))
    } catch (e) {
      console.error('failed to parse: ', e)
    }
  })

  ws.addEventListener('close', outgoing.close)
  ws.addEventListener('error', outgoing.close)

  outgoing.closes(msgs, ws).grantCaps({
    send: m => ws.send(JSON.stringify(m.data)),
    close: outgoing.close,
  })

  return [outgoing, recv]
}
// WebSocket:1 ends here
