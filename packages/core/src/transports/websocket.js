import { channel } from '../channel.js'
import { message } from '../messages.js'

export function fromWebSocket(ws) {
  const [incoming, incomingWriter] = channel()
  ws.addEventListener('message', e => {
    try {
      incomingWriter.send(message(JSON.parse(e.data)))
    } catch (e) {
      console.error('failed to send: ', e)
    }
  })
  ws.addEventListener('close', () => incomingWriter.close())
  ws.addEventListener('error', e => incomingWriter.err(e))

  const [outgoing, outgoingWriter] = channel()
  outgoing
    .sink(v => ws.send(JSON.stringify(v)))
    .then(outgoingWriter.close)
    .catch(outgoingWriter.err)

  return [incoming, outgoingWriter]
}
