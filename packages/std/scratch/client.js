import { connect } from '@bassline/core/transports/socket'
import { consume, delay } from '@bassline/core'
import { session } from '../src/cache.js'
import { cancel, enrich, reply } from '../src/caps.js'
import { collection } from '../src/data/index.js'

const host = process.env.BASSLINE_CAP_HOST ?? '127.0.0.1'
const port = Number(process.env.BASSLINE_CAP_PORT ?? 7878)

const conn = connect({ host, port })
const s = session(conn.send)
const seen = new Set()

conn.ctl.closes(s)
s.ctl.closes(conn)

const done = new Promise(resolve => {
  const mark = name => msg => {
    seen.add(name)
    console.log(`[client] ${name}:`, msg)
    if (seen.size === 2) resolve()
  }

  const msg = enrich(collection([1, 2, 3]), [
    [reply, mark('reply')],
    [cancel, mark('cancel')],
  ])

  s.send(msg)
})

const incoming = consume(conn.recv, raw => {
  const msg = s.lift(raw)
  console.log('[client] ordinary message:', msg)
  reply.invoke(msg, { hello: 'world' })
})

await Promise.race([done, delay(1000)])
if (seen.size < 2) console.log('[client] timed out waiting for caps')

s.close()

await incoming.promise
