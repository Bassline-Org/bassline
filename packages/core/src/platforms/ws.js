import { WebSocketServer, WebSocket as NodeWebSocket } from 'ws'

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

  /**
   * @param {unknown} payload
   */
  const parsePayload = payload => {
    try {
      if (typeof payload === 'string') return JSON.parse(payload)
      if (payload instanceof ArrayBuffer) return JSON.parse(Buffer.from(payload).toString('utf8'))
      if (ArrayBuffer.isView(payload)) {
        return JSON.parse(Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength).toString('utf8'))
      }
      return JSON.parse(String(payload))
    } catch {
      return { __parseError: true }
    }
  }

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
      ws.addEventListener('message', e => cb(parsePayload(e?.data)))
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
     * Start a WebSocket server. Each connection gets a link to localScope.
     *
     * @param {{ port: number, localScope?: import('../types').ResourceFn }} opts
     * @returns {{ wss: WebSocketServer, close: () => Promise<void> }}
     */
    serve({ port, localScope = platform.root }) {
      if (!platform.link?.open) throw new Error('link module required (platform.use(link))')
      const wss = new WebSocketServer({ port })

      wss.on('connection', ws => {
        const transport = wsTransport(ws)
        platform.link.open({ transport, localScope })
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
     * Connect to a WebSocket server and return a link handle.
     *
     * @param {{ url: string, localScope?: import('../types').ResourceFn }} opts
     * @returns {Promise<import('../types').LinkHandle>}
     */
    connect({ url, localScope }) {
      if (!platform.link?.open) throw new Error('link module required (platform.use(link))')
      return new Promise((resolve, reject) => {
        const WebSocketImpl = globalThis.WebSocket ?? NodeWebSocket
        const ws = new WebSocketImpl(url)

        ws.addEventListener('open', () => {
          const transport = wsTransport(ws)
          const linkHandle = platform.link.open({
            transport,
            localScope: localScope ?? platform.create.Scope(),
          })
          resolve(linkHandle)
        })

        ws.addEventListener('error', e => {
          reject(e.error || new Error('WebSocket connection failed'))
        })
      })
    },
  }
}
