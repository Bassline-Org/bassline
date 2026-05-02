import { msg, port } from '../bassline.js'

const description = 'I am a message port.'
export function fromPort(messagePort) {
  const outgoing = msg({ description })
  const [msgs, recv] = port()
  messagePort.onmessage = e => msgs.send(msg(e.data))
  messagePort.onmessageerror = () => outgoing.close()

  outgoing.ctl.closes(msgs, messagePort)

  outgoing.grant('send', msg => {
    const data = msg.data
    if (data) messagePort.postMessage(data)
  })
  return [outgoing, recv]
}
