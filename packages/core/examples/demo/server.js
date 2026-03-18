import { WebSocketServer } from 'ws'
import { serve as serveTcp } from '../../src/serve/tcp.js'
import { serve as serveWs } from '../../src/serve/ws.js'
import { merge, net } from '../../src/channel.js'
import { fault } from '../../src/messages.js'

const sock = process.argv[2] ?? '/tmp/bl-demo.sock'
const port = Number(process.argv[3] ?? 3000)
const serverName = process.argv[4] ?? 'primus-sux'
const log = (...args) => console.log(`[${serverName}]`, ...args)

const wss = new WebSocketServer({ port })
const [tcpConns, tcpServer] = serveTcp({ path: sock })
const [wsConns] = serveWs(wss)
const allConns = merge([tcpConns, wsConns])

const lobby = net()

log(`ws  : ws://localhost:${port}`)
log(`tcp : ${sock}`)
log('---')

function converseWithClient(rClient, wClient) {
  const [rNet, wNet] = lobby.join()
  const clientId = crypto.randomUUID()

  lobby.send({ joined: clientId })
  wClient.send({ hello: 'welcome to the server, here is your id!', id: clientId })

  rNet.sink(wClient)
  rClient
    .guard(
      msg => msg?.id == null || msg?.id === clientId,
      msg => fault('musnt change your id, for I am god over your identity', msg, { clientId })
    )
    .map(msg => ({ ...msg, id: clientId, reflectedBy: serverName, ts: Date.now() }))
    .tap(msg => log('msg', JSON.stringify(msg)))
    .sink(wNet)
    .then(() => lobby.send({ left: clientId }))
}

await allConns.sink(([read, write]) => converseWithClient(read, write))

process.on('SIGINT', () => {
  tcpServer.close()
  wss.close()
  process.exit()
})
