import { channel } from '../src/channel.js'
import { connect } from '../src/transports/socket.js'
import { message, update } from '../src/messages.js'
import { debounce } from './channel-example.js'

const sock = '/tmp/bl-book-test.sock'

const [read, write] = connect({ path: sock })

const [r, w] = channel()
const task = r
  .thru(debounce(1000))
  .map(v => message(v))
  .map(update(_msg => ({ theTimeIs: Date.now() })))
  .sink(write.send)
  .then(write.close)
  .catch(write.err)

w.send(
  message({ body: 'hello' }),
  message({ body: 'world' }),
  message({ heart: 'beat' }),
  message({ heart: 'beat' }),
  message({ heart: 'beat' })
)

w.close()

await Promise.all([task, read.sink(msg => console.log('received:', msg))])

console.log('closed')
