import { message, consume } from '../bassline.js'

export function readFrame(recv, dest) {
  let buffer = ''
  const prop = consume(recv, (chunk, send) => {
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
  prop.to(dest)
  return prop
}

export const format = msg => JSON.stringify(msg) + '\n'

export default { read: readFrame, format }
