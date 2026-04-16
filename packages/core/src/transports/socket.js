import net from 'node:net'
import { port, createController } from '../bassline.js'
import defaultFrame from '../frame/jsonl.js'

export function fromSocket(socket, frame = defaultFrame) {
  const { close, ctl } = createController()
  const raw = port()
  const msgs = port()
  frame.read(raw.recv).to(msgs.send)

  socket.on('data', chunk => raw.send(chunk.toString()))
  socket.on('close', close)
  socket.on('end', close)
  socket.on('error', close)

  ctl.onClose(() => {
    raw.close()
    msgs.close()
    socket.destroy()
  })

  return {
    recv: msgs.recv,
    send: msg => void socket.write(frame.format(msg)),
    ctl,
    close,
  }
}

export function connect(options = {}, frame = defaultFrame) {
  return fromSocket(net.createConnection(options), frame)
}
