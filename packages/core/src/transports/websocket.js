import { channel } from '../channel.js'
import { message } from '../messages.js'

export function fromWebSocket(ws) {
  const [read, write] = channel()
  ws.addEventListener('message', e => {
    try {
      write.send(message(JSON.parse(e.data)))
    } catch (e) {
      console.error('failed to send: ', e)
    }
  })
  ws.addEventListener('close', () => write.close())
  ws.addEventListener('error', e => write.err(e))

  const [outRead, outWrite] = channel()
  outRead
    .sink(v => ws.send(JSON.stringify(v)))
    .then(outWrite.close)
    .catch(outWrite.err)

  return [read, outWrite]
}
