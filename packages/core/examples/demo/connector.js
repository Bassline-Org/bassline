import { channel } from '../../src/channel.js'
import { connect } from '../../src/transports/socket.js'

const lobby = process.argv[2] ?? '/tmp/bl-demo.sock'
const active = new Set()
const [read, write] = channel()

const attach = path => {
  if (active.has(path)) return
  active.add(path)

  const [connRead] = connect({ path })
  console.log('connected to', path, 'total:', active.size)

  connRead.sink(write.send).finally(() => {
    active.delete(path)
    console.log('disconnected from:', path, 'total:', active.size)
  })
}

attach(lobby)

read
  .fork(r =>
    r
      .filter(msg => typeof msg?.transport?.tcp === 'string')
      .map(msg => msg.transport.tcp)
      .filter(path => !active.has(path))
      .sink(attach)
  )
  .sink(console.log)
