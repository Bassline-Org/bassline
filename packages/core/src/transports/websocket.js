import { port, message, createController } from '../bassline.js'

export function fromWebSocket(ws) {
  const { ctl, close } = createController()
  const p = port()
  ws.addEventListener('message', e => {
    try {
      p.send(message(JSON.parse(e.data)))
    } catch (e) {
      console.error('failed to parse: ', e)
    }
  })
  ws.addEventListener('close', close)
  ws.addEventListener('error', close)
  ctl.closes(ws, p)
  const send = msg => void ws.send(JSON.stringify(msg))

  return { recv: p.recv, send, ctl, close }
}
