import { port, message } from '../bassline.js'

export function fromWebSocket(ws) {
  const p = port()
  ws.addEventListener('message', e => {
    try {
      p.send(message(JSON.parse(e.data)))
    } catch (e) {
      console.error('failed to parse: ', e)
    }
  })
  ws.addEventListener('close', () => p.close())
  ws.addEventListener('error', () => p.close())

  return {
    recv: p.recv,
    send: msg => ws.send(JSON.stringify(msg)),
    close: () => {
      p.close()
      ws.close()
    },
  }
}
