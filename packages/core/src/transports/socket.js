// [[file:../../book/v2.org::*Socket][Socket:1]]
import net from 'node:net'
import { msg, port } from '../bassline.js'
import defaultFrame from '../frame/jsonl.js'

const description = `\
I am a socket.
I allow interactions with socket-like interfaces.
Any messages I am sent, is forwarded over the wire as data,
stripping it's caps.`

export function fromSocket(socket, frame = defaultFrame) {
  const outgoing = msg()
    .merge({ description })
    .grantCaps({
      send: m => socket.write(frame.format(m)),
      close: outgoing.close,
    })

  const [reader, onRead] = frame.reader()
  const [msgs, recv] = port()
  onRead(m => msgs.send(m))

  outgoing.closes(reader, msgs).onClose(() => socket.destroy())

  socket.on('data', chunk =>
    reader.send(msg().merge({ scalar: chunk.toString() }))
  )
  socket.on('close', outgoing.close)
  socket.on('end', outgoing.close)
  socket.on('error', outgoing.close)

  return [outgoing, recv]
}

export function connect(options = {}, frame = defaultFrame) {
  return fromSocket(net.createConnection(options), frame)
}
// Socket:1 ends here
