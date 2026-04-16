import { port, message } from '../bassline.js'

export function fromWebSocket(ws) {
  const p = port()
  const { recv, ctl, close } = p
  ws.addEventListener('message', e => {
    try {
      p.send(message(JSON.parse(e.data)))
    } catch (e) {
      console.error('failed to parse: ', e)
    }
  })
  ws.addEventListener('close', close)
  ws.addEventListener('error', close)
  ctl.closes(ws)
  const send = msg => void ws.send(JSON.stringify(msg))

  return { recv, send, ctl, close }
}
