import { net } from '../../src/channel.js'

const lobby = net()

const logged = message => reader =>
  reader.sink({
    send: value => console.log(message, ' ', value),
    close: () => console.log(message, ' closed'),
    err: e => console.error(message, ' error: ', e),
  })

const [_ra, ta] = lobby.join(logged('a'))
const [_rb, tb] = lobby.join(logged('b'))
const [_rc, tc] = lobby.join(logged('c'))
const [_rd, td] = lobby.join(logged('d'))

ta.send(1)
tb.send(2)
tc.send(3)
td.send(4)

await new Promise(res => setTimeout(res, 1000))
td.close()
tb.close()

lobby.close()
