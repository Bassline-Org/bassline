#!/usr/bin/env node
import { propagator, cell, consume } from '@bassline/core'
import { serve } from '@bassline/core/serve/tcp'
import { session } from '@bassline/std/cache'
import { conforms, invariants } from '@bassline/std/shape'
import {
  send as sendCap,
  reply,
  reject,
  close as closeCap,
  ping,
  cancel,
  enrich,
} from '@bassline/std/caps'

const [, , socketPath = '/tmp/bassline.sock'] = process.argv

const { connections, close: stopServer } = serve({ path: socketPath })

const feed = propagator()

const known = cell((state, inc, update) => {
  const { removed, id } = inc
  if (removed) {
    if (!state.has(id)) return
    state.delete(id)
    update(state)
  } else {
    if (state.has(id)) return
    state.set(inc.id, inc)
    update(state)
  }
}, new Map())

feed.to(known.send)

let counter = 0
const newId = () => `i${++counter}`

const hasAnyCap = msg =>
  [sendCap, reply, reject, closeCap, ping, cancel].some(c => c.check(msg))

consume(connections, conn => {
  const sesh = session(conn.send)
  conn.ctl.closes(sesh)
  sesh.ctl.onClose(() => console.log('client left'))

  const subscribeCmd = invariants([
    [conforms({ cmd: 'subscribe' }), 'not command shaped'],
    [reply.check, 'missing reply cap'],
    [sendCap.check, 'missing send cap'],
  ])

  function archive(msg) {
    const id = newId()
    feed.send({ id, ...msg })
    sesh.ctl.onClose(() => feed.send({ id, removed: true }))
  }

  function subscribe(msg) {
    const deliver = item => sendCap.invoke(msg, item)
    const cleanup = feed.to(deliver)
    sesh.ctl.onClose(cleanup)
    for (const [_id, intro] of known.value()) deliver(intro)
    reply.invoke(msg, { description: 'subscribed' })
  }

  function handleIncoming(msg) {
    if (subscribeCmd.test(msg)) return subscribe(msg)
    if (hasAnyCap(msg)) return archive(msg)
    console.log('unhandled:', msg)
  }

  sesh.send(
    enrich({ description: 'bassline daemon — contribute or subscribe' }, [
      [sendCap, handleIncoming],
      [closeCap, () => conn.close()],
    ])
  )

  consume(conn.recv, msg => {
    const m = sesh.dispatch(msg)
    if (m) console.log('unhandled raw:', m)
  })

  console.log('peer connected')
})

const stop = () => {
  stopServer()
  feed.close()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

console.log(`daemon listening on ${socketPath}`)
