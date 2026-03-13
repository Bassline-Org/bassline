import { channel } from '../channel.js'
import { message } from '../messages.js'

export function fromPort(port) {
  const [read, write] = channel()
  port.onmessage = e => write.send(message(e.data))
  port.onmessageerror = e => write.err(e)

  const [outRead, outWrite] = channel()
  outRead
    .sink(v => port.postMessage(v))
    .then(outWrite.close)
    .catch(outWrite.err)

  return [read, outWrite]
}
