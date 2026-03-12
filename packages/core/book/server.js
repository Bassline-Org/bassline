import net from 'node:net'
import { readFrames, writeFrames } from './client.js'
import { channel } from './channel.js'

export function serve(options = {}) {
  const [r, w] = channel();

  const server = net.createServer(socket => {
    const read = readFrames(socket)
    const write = writeFrames(socket);
    w.send([read, write])
  })
  server.listen(options)
  server.on('close', w.close)
  server.on('error', w.err)
  return [r, server]
}