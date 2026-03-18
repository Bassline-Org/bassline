import { connect } from '../../src/transports/socket.js'

const lobby = process.argv[2] ?? '/tmp/bl-demo.sock'
const endpoint = process.argv[3] ?? '/tmp/bl-other.sock'
const offers = (process.argv[4] ?? '')
  .split(',')
  .map(name => name.trim())
  .filter(Boolean)

const [read, write] = connect({ path: lobby })
const offer = { offer: offers, transport: { tcp: endpoint } }

read.fork(r => r.filter(msg => msg?.body?.includes('pls offer')).sink(() => write.send(offer))).sink(console.log)
