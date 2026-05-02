import { propagator, is, msg } from '../bassline.js'

const description = `\
I am a reader.
I read messages into a buffer, parsed as JSONL values.
I can be sent messages like {scalar: string}.
I emit parsed messages.`

const validChunk = m => m.conforms({ scalar: is.string })

export function reader() {
  let buffer = ''
  const [m, to] = propagator((aMsg, send) => {
    if (!validChunk(aMsg)) return
    buffer += aMsg.get('scalar')
    let nl
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      try {
        send(msg(JSON.parse(line)))
      } catch (e) {
        console.error('readFrame parse error: ', e)
      }
    }
  })
  m.merge({ description })
  return [m, to]
}

export const format = aMsg => {
  let data = aMsg
  if (is.msg(aMsg)) {
    data = aMsg.data
  }
  return JSON.stringify(data) + '\n'
}

export default { reader, format }
