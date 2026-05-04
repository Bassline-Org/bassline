import { msg, port } from '../bassline.js'

const description = 'I am a message port.'
export function fromPort(messagePort) {
  const outgoing = msg({ description })
  const [msgs, recv] = port()
  messagePort.onmessage = e => msgs.send(msg(e.data))
  messagePort.onmessageerror = () => outgoing.close()

  outgoing.closes(msgs, messagePort)

  outgoing.grantAll({
    send: m => {
      const data = m.data
      if (data) messagePort.postMessage(data)
    },
    close: outgoing.close,
  })
  return [outgoing, recv]
}
