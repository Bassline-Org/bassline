import net from 'node:net'
import { msg, port } from '../bassline.js'
import defaultFrame from '../frame/jsonl.js'

const description = `\
I am a socket.
I allow interactions with socket-like interfaces.
Any messages I am sent, is forwarded over the wire as data.`

export function fromSocket(socket, frame = defaultFrame) {
  const outgoing = msg({ description }, { send })
  const [reader, onRead] = frame.reader()
  const [msgs, recv] = port()
  onRead(m => msgs.send(m))

  function send(m) {
    socket.write(frame.format(m))
  }
  function close() {
    outgoing.close()
  }

  outgoing.ctl.closes(reader, msgs)
  outgoing.ctl.onClose(() => socket.destroy())

  socket.on('data', chunk => reader.send(msg({ scalar: chunk.toString() })))
  socket.on('close', close)
  socket.on('end', close)
  socket.on('error', close)

  return [outgoing, recv]
}

export function connect(options = {}, frame = defaultFrame) {
  return fromSocket(net.createConnection(options), frame)
}
