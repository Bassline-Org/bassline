#!/usr/bin/env node
import { connect } from '@bassline/core/transports/socket'
import { sessionConnect } from '@bassline/std/cache'
import { PortLike, advertise, matches } from '@bassline/std/roles'

const [, , socketPath = '/tmp/bassline.sock'] = process.argv

const conn = connect({ path: socketPath })

let contributed = false

const onArchive = matches(PortLike, arch => {
  if (arch.msg.name !== 'archive') return
  if (contributed) return
  contributed = true
  const intro = advertise(
    { description: 'a logger' },
    {
      send: msg => console.log('logger received:', msg),
      close: () => console.log('logger close (no-op)'),
    }
  )
  arch.send(intro)
  console.log('contributed logger intro')
})

sessionConnect(conn, onArchive)

const stop = () => conn.close()
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

console.log(`publisher connected to ${socketPath}`)
