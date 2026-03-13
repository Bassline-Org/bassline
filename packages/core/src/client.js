import net from 'node:net'
import { message } from './messages.js'
import { channel } from './channel.js'

export function readFrames(socket) {
  const [read, write] = channel()
  let buffer = ''
  socket.on('data', chunk => {
    buffer += chunk
    let newline
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline)
      buffer = buffer.slice(newline + 1)
      if (!line) continue
      try {
        write.send(message(JSON.parse(line)))
      } catch (e) {
        console.error('parse error: ', e)
      }
    }
  })
  socket.on('close', () => {
    write.close()
    console.log('connection closed')
  })
  socket.on('error', e => {
    write.err(e)
    console.log('connection error')
  })
  return read
}

export function writeFrames(socket) {
  const [read, write] = channel()
  read
    .sink(v => socket.write(JSON.stringify(v) + '\n'))
    .then(() => socket.destroy())
    .catch(e => socket.destroy(e))
  socket.on('close', write.close)
  socket.on('error', write.err)
  return write
}

export function connect(options = {}) {
  const socket = net.createConnection(options)
  const read = readFrames(socket)
  const write = writeFrames(socket)
  return [read, write]
}
