// [[file:../../book/v2.org::*WebWorker][WebWorker:1]]
import { msg, port } from '../bassline.js'

const description = 'I am a message port.'
export function fromPort(messagePort) {
  const outgoing = msg().merge({ description })
  const [msgs, recv] = port()
  messagePort.onmessage = e => msgs.send(msg().merge(e.data))
  messagePort.onmessageerror = outgoing.close

  outgoing.closes(msgs, messagePort).grantCaps({
    send: m => messagePort.postMessage(m.data),
    close: outgoing.close,
  })
  return [outgoing, recv]
}
// WebWorker:1 ends here
