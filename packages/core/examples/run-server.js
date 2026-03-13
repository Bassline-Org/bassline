import { serve } from '../src/serve/tcp.js'
import { message } from '../src/messages.js'

const resource = msg => {
  console.log('got:', msg)
  return message({ pong: true, got: msg })
}

const sock = '/tmp/bl-book-test.sock'

const [readConnections, s] = serve({ path: sock })

process.on('SIGINT', () => {
  console.log('shutting down')
  s.close()
})

const messages = new Set()

try {
  console.log('starting')
  await readConnections.sink(([r, w]) => {
    console.log('new connection')
    r.tap(msg => messages.add(msg))
      .sink(v => w.send(resource(v)))
      .then(() => console.log('socket closed'))
  })
  console.log('closed')
} finally {
  s.close()
}
