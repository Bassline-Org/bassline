import net from 'node:net'
import { port } from '../comm.js'
import defaultFrame from '../frame/jsonl.js'

export function fromSocket(socket, frame = defaultFrame) {
  const raw = port()
  const msgs = port()

  socket.on('data', chunk => raw.send(chunk.toString()))
  socket.on('close', () => raw.close())
  socket.on('error', () => raw.close())

  frame.read(raw.recv, msgs.send)

  return {
    recv: msgs.recv,
    send: msg => socket.write(frame.format(msg)),
    close: () => {
      msgs.close()
      raw.close()
      socket.destroy()
    },
  }
}

export function connect(options = {}, frame = defaultFrame) {
  return fromSocket(net.createConnection(options), frame)
}
