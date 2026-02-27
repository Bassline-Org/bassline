import { WebSocketServer } from 'ws'

/**
 * Wrap a WebSocket into a Transport.
 * Works with both the `ws` library and the global WebSocket (Node 22+).
 *
 * @param {WebSocket} ws
 * @returns {import('../types').Transport}
 */
export function wsTransport(ws) {
  let closed = false
  const closeHandlers = []

  ws.addEventListener('close', () => {
    if (closed) return
    closed = true
    for (const cb of closeHandlers) cb()
  })

  return {
    send(msg) {
      if (closed) throw new Error('transport closed')
      ws.send(JSON.stringify(msg))
    },
    onMessage(cb) {
      ws.addEventListener('message', e => cb(JSON.parse(e.data)))
    },
    close() {
      if (closed) return
      closed = true
      ws.close()
      for (const cb of closeHandlers) cb()
    },
    onClose(cb) {
      closeHandlers.push(cb)
    },
  }
}

/** @param {import('../types').Platform} platform */
export default function wsPlatform(platform) {
  platform.ws = {
    /**
     * Start a WebSocket server. Each connection gets a Session with platform.root.
     *
     * @param {{ port: number }} opts
     * @returns {{ wss: WebSocketServer, close: () => Promise<void> }}
     */
    serve({ port }) {
      const wss = new WebSocketServer({ port })

      wss.on('connection', ws => {
        const transport = wsTransport(ws)
        platform.create.Session({ transport, root: platform.root })
      })

      function close() {
        return new Promise(resolve => {
          for (const client of wss.clients) client.terminate()
          wss.close(() => resolve())
        })
      }

      return { wss, close }
    },

    /**
     * Connect to a WebSocket server and return a Session resource function.
     *
     * @param {{ url: string }} opts
     * @returns {Promise<import('../types').ResourceFn>}
     */
    connect({ url }) {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(url)

        ws.addEventListener('open', () => {
          const transport = wsTransport(ws)
          const session = platform.create.Session({ transport })
          session.close = () => transport.close()
          resolve(session)
        })

        ws.addEventListener('error', e => {
          reject(e.error || new Error('WebSocket connection failed'))
        })
      })
    },
  }
}
