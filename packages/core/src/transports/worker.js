import { port, message, createController } from '../bassline.js'

export function fromPort(messagePort) {
  const { ctl, close } = createController()
  const p = port()
  messagePort.onmessage = e => p.send(message(e.data))
  messagePort.onmessageerror = () => close()
  ctl.closes(p)
  const send = msg => messagePort.postMessage(msg)
  return { send, recv: p.recv, ctl, close }
}
