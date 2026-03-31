import { port, message } from '../bassline.js'

export function fromPort(messagePort) {
  const p = port()
  messagePort.onmessage = e => p.send(message(e.data))
  messagePort.onmessageerror = () => p.close()

  return {
    recv: p.recv,
    send: msg => messagePort.postMessage(msg),
    close: () => p.close(),
  }
}
