#!/usr/bin/env node
import { connect } from '@bassline/core/transports/socket'
import { sessionConnect } from '@bassline/std/cache'
import { send as sendCap, reply, reject, enrich } from '@bassline/std/caps'
import { PortLike, Request, Ping, matches } from '@bassline/std/roles'

const [, , socketPath = '/tmp/bassline.sock'] = process.argv

const conn = connect({ path: socketPath })

let subscribed = false

const onDaemon = matches(PortLike, daemon => {
  if (subscribed) return
  subscribed = true
  const subReq = enrich({ cmd: 'subscribe' }, [
    [reply, ack => console.log('subscribed:', ack.description)],
    [reject, err => console.log('rejected:', err)],
    [sendCap, describe],
  ])
  daemon.send(subReq)
  console.log('subscribe request sent')
})

sessionConnect(conn, onDaemon)

function describe(item) {
  if (item.removed) {
    console.log(`removed: ${item.id}`)
    return
  }
  const tags = []
  const portLikeInst = PortLike.match(item)
  if (portLikeInst) tags.push('PortLike')
  if (Request.match(item)) tags.push('Request')
  if (Ping.match(item)) tags.push('Ping')
  console.log(
    `${item.id}: ${item.description ?? '(no description)'} [${
      tags.join(', ') || 'no recognized roles'
    }]`
  )
  if (portLikeInst) {
    portLikeInst.send({ probe: 'hello from reader' })
  }
}

const stop = () => conn.close()
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

console.log(`reader connected to ${socketPath}`)
