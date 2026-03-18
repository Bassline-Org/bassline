import { message } from '../messages.js'
import { channel } from '../channel.js'

export const readFrame = reader => {
  const [readMsg, writeMsg] = channel()
  let buffer = ''
  reader
    .sink(chunk => {
      buffer += chunk
      let nl
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl)
        buffer = buffer.slice(nl + 1)
        if (!line) continue
        try {
          writeMsg.send(message(JSON.parse(line)))
        } catch (e) {
          console.error('readFrame parse error: ', e)
        }
      }
    })
    .then(writeMsg.close)
    .catch(writeMsg.err)
  return readMsg
}

export const format = msg => JSON.stringify(msg) + '\n'

export default { read: readFrame, format }
