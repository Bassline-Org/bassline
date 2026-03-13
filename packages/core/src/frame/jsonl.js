import { message } from '../messages.js'
import { channel } from '../channel.js'

export const readFrame = reader => {
  const [out, write] = channel()
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
          write.send(message(JSON.parse(line)))
        } catch (e) {
          console.error('readFrame parse error: ', e)
        }
      }
    })
    .then(write.close)
    .catch(write.err)
  return out
}

export const writeFrame = msg => JSON.stringify(msg) + '\n'
