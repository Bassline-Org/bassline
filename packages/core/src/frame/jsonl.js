// [[file:../../book/v2.org::*Framing][Framing:1]]
import { propagator, is, msg } from '../bassline.js'

const description = `\
I am a reader.
I can be sent messages like {scalar: string}.
I read messages into a buffer, parsed as JSONL values.
I emit parsed messages.`

export function reader() {
  let buffer = ''
  const [m, to] = propagator((aMsg, send) => {
    const chunk = aMsg.get('scalar')
    if (!is.string(chunk)) return
    buffer += chunk
    let nl
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      try {
        send(msg().merge(JSON.parse(line)))
      } catch (e) {
        console.error('readFrame parse error: ', e)
      }
    }
  })
  m.merge({ description })
  return [m, to]
}

export const format = aMsg => JSON.stringify(aMsg.data) + '\n'

export default { reader, format }
// Framing:1 ends here
