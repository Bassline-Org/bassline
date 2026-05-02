import { port, msg } from '../bassline.js'

const description = `I am a web socket.`

export function fromWebSocket(ws) {
  const outgoing = msg({ description })
  const [msgs, recv] = port()
  ws.addEventListener('message', e => {
    try {
      msgs.send(msg(JSON.parse(e.data)))
    } catch (e) {
      console.error('failed to parse: ', e)
    }
  })

  const close = () => outgoing.close()
  ws.addEventListener('close', close)
  ws.addEventListener('error', close)

  function send(m) {
    const data = m.data
    if (data) ws.send(JSON.stringify(data))
  }
  outgoing.grant('send', send)
  outgoing.ctl.closes(msgs, ws)

  return [outgoing, recv]
}
