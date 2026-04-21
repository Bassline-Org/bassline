import { serve } from '@bassline/core/serve/tcp'
import { consume, propagator } from '@bassline/core'
import { factotum, persistFile } from './exchange.js'
import { KeyNotFound } from './mm.js'

const config = {
  tcp: {
    host: '0.0.0.0',
    port: '6969',
  },
  unix: {
    path: '/tmp/bassline-server.sock',
  },
}

const options = config.tcp

const { connections, ctl, close } = serve(options)

const fac = factotum(persistFile('/tmp/server-records.json'))
ctl.closes(fac)

const bus = propagator(msg => {
  try {
    fac.materialize(msg)
    console.log(fac)
  } catch (e) {
    if (e instanceof KeyNotFound) {
      console.log('unknown: ', msg)
    } else {
      throw e
    }
  }
})

console.log('starting: ', options)
consume(connections, conn => {
  console.log('new client')
  const client = consume(conn.recv, msg => {
    bus.send(msg)
  })
  client.ctl.onClose(() => {
    console.log('client left')
  })
  ctl.closes(client)
})

process.on('SIGINT', exit)
process.on('SIGTERM', exit)

function exit() {
  close()
  process.exit(0)
}
