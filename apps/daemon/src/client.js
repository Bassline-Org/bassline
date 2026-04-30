import { consume } from '@bassline/core'
import { connect } from '@bassline/core/transports/socket'
import { PortLike, requester, matches } from '@bassline/std/roles'
import { session } from '@bassline/std/cache'

const [_, __, socket = '/tmp/bassline.sock'] = process.argv

const client = connect({ path: socket })

const sesh = session(client.send)

console.log('connected to: ', socket)

const onPort = matches(PortLike, async match => {
  const ask = requester({ send: msg => match.send(msg) })
  let res = await ask({ hello: 'world' })
  console.log('res:', res)
  res = await ask({ msg: 'hello-again' })
  console.log('res:', res)
  match.close()
})

consume(client.recv, msg => {
  console.log('received: ', msg)
  const m = sesh.dispatch(msg)
  if (!m) return
  onPort(m)
})

process.on('SIGINT', client.close)
process.on('SIGTERM', client.close)
client.ctl.onClose(() => {
  console.log('disconnecting')
})

console.log(client)
