/**
 * @import {Msg, Recv} from "@bassline/core"
 */
import { msg, consume } from '@bassline/core'
import { serve } from '@bassline/core/serve/tcp'

const hello = msg({
  description: 'welcome to a simple server, I hope you enjoy your stay.',
})

const options = { port: 6969 }

const [m, server] = serve(onConnect, options)

console.log('started server: ', m)
console.log(server)

process.on('SIGINT', () => m.close())
m.ctl.onClose(() => console.log('shutting down'))

/**
 *
 * @param {[Msg, Recv]} param0
 */
function onConnect([client, recv]) {
  console.log('client connected')
  // @todo replace this with a proper cache
  client.send(hello.data)
  consume(recv, m => console.log('client message: ', m))
  client.ctl.onClose(() => console.log('client disconnected'))
}
