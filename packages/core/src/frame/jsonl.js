import { message } from '../messages.js'
import { consume } from '../comm.js'

export function readFrame(recv, send) {
  let buffer = ''
  consume(recv, chunk => {
    buffer += chunk
    let nl
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      try {
        send(message(JSON.parse(line)))
      } catch (e) {
        console.error('readFrame parse error: ', e)
      }
    }
  })
}

export const format = msg => JSON.stringify(msg) + '\n'

export default { read: readFrame, format }
