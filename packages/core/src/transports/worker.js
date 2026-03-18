import { channel } from '../channel.js'
import { message } from '../messages.js'

export function fromPort(port) {
  const [incoming, incomingWriter] = channel()
  port.onmessage = e => incomingWriter.send(message(e.data))
  port.onmessageerror = e => incomingWriter.err(e)

  const [outgoing, outgoingWriter] = channel()
  outgoing
    .sink(v => port.postMessage(v))
    .then(outgoingWriter.close)
    .catch(outgoingWriter.err)

  return [incoming, outgoingWriter]
}
