import net from 'node:net'
import { channel } from '../channel.js'
import { readFrame, writeFrame } from '../frame/jsonl.js'

export function fromSocket(socket) {
  const [read, write] = channel()
  socket.on('data', chunk => write.send(chunk.toString()))
  socket.on('close', () => write.close())
  socket.on('error', e => write.err(e))

  const [outRead, outWrite] = channel()
  outRead
    .map(writeFrame)
    .sink(data => socket.write(data))
    .then(() => socket.destroy())
    .catch(e => socket.destroy(e))
  socket.on('close', outWrite.close)
  socket.on('error', outWrite.err)

  return [read.thru(readFrame), outWrite]
}

export function connect(options = {}) {
  return fromSocket(net.createConnection(options))
}
