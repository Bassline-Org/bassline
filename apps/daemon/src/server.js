#!/usr/bin/env node
import { cell, consume } from '@bassline/core'
import { serve } from '@bassline/core/serve/tcp'
import { send, close } from '@bassline/std/caps'
import { Msg, Cache } from '@bassline/std/message'

const [, , socketPath = '/tmp/bassline.sock'] = process.argv

const { connections, close: stopServer } = serve({ path: socketPath })

const known = cell((state, inc, update) => {
  const { removed, id } = inc
  if (removed) {
    if (!state.has(id)) return
    state.delete(id)
    update(state)
  } else {
    if (state.has(id)) return
    state.set(id, inc)
    update(state)
  }
}, new Map())

let counter = 0
const newId = () => `i${++counter}`

consume(connections, conn => {
  const local = new Cache()
  const remote = new Cache()
  conn.ctl.onClose(() => local.clear())
  conn.ctl.onClose(() => remote.clear())

  const sendRaw = msg => local.sendRaw(msg, conn.send)

  const archive = new Msg()
    .merge({ name: 'archive', description: 'submit intros for the feed' })
    .grant(send.spelling, intro => {
      const id = newId()
      known.send(intro.copy({ id }))
      conn.ctl.onClose(() => known.send(new Msg({ id, removed: true })))
    })
    .grant(close.spelling, archive.close)

  const subscribe = new Msg()
    .merge({ name: 'subscribe', description: 'be sent feed events' })
    .grant(send.spelling, req => {
      const cleanup = known.to(item => req.invoke(send.spelling, item))
      conn.ctl.onClose(cleanup)
      for (const [_id, intro] of known.value()) req.invoke(send.spelling, intro)
    })
    .grant(close.spelling, subscribe.close)

  consume(conn.recv, msg => {
    const bound = remote.fromRaw(msg, sendRaw)
    local.dispatchVia(bound)
  })

  local.sendRaw(archive, conn.send).sendRaw(subscribe, conn.send)

  console.log('peer connected')
})

const stop = () => {
  stopServer()
  known.close()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

console.log(`daemon listening on ${socketPath}`)
