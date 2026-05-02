import { consume, msg } from '@bassline/core'
import { connect } from '@bassline/core/transports/socket'
import { fromStdio } from '@bassline/core/node'

const options = { port: '6969' }

const hello = msg({
  description: 'Hello, I am a client, thank you for hosting me.',
})

const [m, recv] = connect(options)

const [io] = fromStdio()

console.log('connected: ', m)

m.ctl.closes(io)
m.ctl.onClose(() => console.log('disconnected'))

m.send(hello)
consume(recv, msg => {
  io.send(msg)
})

process.on('SIGINT', () => m.close())
