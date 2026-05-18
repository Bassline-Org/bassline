#!/usr/bin/env node
import { msg } from '@bassline/core'
import { connect } from '@bassline/core/transports/node'
import { dialogue, call } from '@bassline/std'
import { inspector } from './inspector.js'

const [, , socketPath = '/tmp/bassline.sock'] = process.argv

const [conn, onMsg] = dialogue(connect({ path: socketPath }))

onMsg(async aMsg => {
  inspector.send(aMsg)

  const lobby = aMsg

  const [r, w] = lobby.get('bindings').get(['read', 'write'])
  await call(w, msg({ key: 'foo', val: msg({ hello: Date.now().toString() }) }))

  const interval = setInterval(async () => {
    inspector.send(await call(r, msg({ key: 'foo' })))
  }, 500)

  conn.onClose(() => clearInterval(interval))
})

process.on('SIGINT', onClose)
process.on('SIGTERM', onClose)

function onClose() {
  conn.close()
}
