import net from 'node:net'
import { channel, closeAll, errAll } from '../channel.js'
import defaultFrame from '../frame/jsonl.js'

export function fromSocket(socket, frame = defaultFrame) {
  const [incoming, writeIncoming] = channel()
  const [outgoing, writeOutgoing] = channel()

  socket.on('data', chunk => writeIncoming.send(chunk.toString()))
  socket.on('close', () => closeAll(writeIncoming, writeOutgoing))
  socket.on('error', e => errAll(e, writeIncoming, writeOutgoing))

  outgoing
    .map(v => frame.format(v))
    .sink(data => socket.write(data))
    .then(() => socket.destroy())
    .catch(e => socket.destroy(e))

  return [incoming.thru(frame.read), writeOutgoing]
}

export function connect(options = {}, frame = defaultFrame) {
  return fromSocket(net.createConnection(options), frame)
}
