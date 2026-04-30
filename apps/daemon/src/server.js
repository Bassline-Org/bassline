#!/usr/bin/env node
import { consume } from '@bassline/core'
import { serve } from '@bassline/core/serve/tcp'
import { session } from '@bassline/std/cache'
import * as caps from '@bassline/std/caps'
import introduce from './systems/index.js'

const [_, __, socket = '/tmp/bassline.sock'] = process.argv

const { connections, close } = serve({ path: socket })

const sessions = new Set()

consume(connections, conn => {
  console.log('new client')

  const sesh = session(conn.send)

  sessions.add(sesh)

  sesh.ctl.onClose(() => {
    sessions.delete(sesh)
    console.log('client left. sessions: ', sessions)
  })

  conn.ctl.closes(sesh)

  introduce(sesh)

  consume(conn.recv, msg => {
    const m = sesh.dispatch(msg)
    if (m) {
      console.log('unhandled message: ', m)
      sesh.send({ unhandled: m })
    }
  })
})

process.on('SIGINT', close)
process.on('SIGTERM', close)

console.log('caps: ', caps)
