import { consume } from '@bassline/core'
import { serve } from '@bassline/core/serve/tcp'
import { session } from '../src/cache.js'
import { cancel, reply } from '../src/caps.js'
import { scalar } from '../src/data/index.js'

const host = process.env.BASSLINE_CAP_HOST ?? '127.0.0.1'
const port = Number(process.env.BASSLINE_CAP_PORT ?? 7878)

const { connections, server, ctl, close } = serve({ host, port })

server.on('listening', () => {
  console.log(`[server] listening on ${host}:${port}`)
})
server.on('error', err => {
  console.error(`[server] ${err.message}`)
})

consume(connections, conn => {
  console.log('[server] client connected')

  const s = session(conn.send)

  conn.ctl.closes(s)

  const incoming = consume(conn.recv, raw => {
    const msg = s.dispatch(raw)
    if (!msg) return
    console.log('received', msg)
    reply.invoke(
      msg,
      reply.grant(scalar('server accepted the collection'), msg =>
        console.log('client said: ', msg)
      )
    )
    cancel.invoke(msg, scalar('server is done with the example'))
  })

  s.ctl.closes(conn, incoming)
})

process.on('SIGINT', close)
process.on('SIGTERM', close)
ctl.onClose(() => console.log('[server] closed'))
