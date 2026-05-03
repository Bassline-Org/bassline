/**
 * @import {Msg, Recv} from "@bassline/core"
 */
import { msg } from '@bassline/core'
import { serve } from '@bassline/core/serve/tcp'
import { createCache, conversation } from '@bassline/std/cache'

const [_cache, { toData, dispatch, entries }] = createCache()

const greet = msg({
  description: 'welcome to a simple server, I hope you enjoy your stay.',
})

const options = { port: 6969 }

const [m, server] = serve(onConnect, options)
console.log('started server: ', m)
console.log(server)

process.on('SIGINT', () => m.close())
m.ctl.onClose(() => console.log('shutting down'))

const convos = new Set()

/**
 *
 * @param {[Msg, Recv]} param0
 */
function onConnect([client, recv]) {
  console.log('client connected')
  const [conv, onMsg] = conversation(client, { recv, toData, dispatch })
  convos.add(conv)
  conv.send(greet)
  onMsg(aMsg => {
    aMsg.invoke('foo', msg({ scalar: 'hi from server' }))
    for (const c of convos) c.send(aMsg)
  })
  client.ctl.onClose(() => {
    convos.delete(conv)
    console.log('client disconnected')
  })
}

const i = setInterval(() => {
  console.log('size: ', entries().length)
}, 50)
m.ctl.onClose(() => {
  clearInterval(i)
})
