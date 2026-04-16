import { port, message } from '../bassline.js'

export function fromPort(messagePort) {
  const p = port()
  const { recv, ctl, close } = p
  messagePort.onmessage = e => p.send(message(e.data))
  messagePort.onmessageerror = () => close()
  const send = msg => messagePort.postMessage(msg)
  return { send, recv, ctl, close }
}
