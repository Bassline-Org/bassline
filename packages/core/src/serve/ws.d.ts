import type { Msg, PortLike, Recv } from '../bassline.js'

export interface WebSocketServerLike {
  on(event: 'connection', cb: (ws: WebSocket) => void): void
  on(event: 'close' | 'error', cb: () => void): void
}

export type Connection = [PortLike, Recv]
export type OnConnect = (conn: Connection) => void

export function serve<WSS extends WebSocketServerLike>(
  wss: WSS,
  onConnect: OnConnect
): [
  Msg<{ description: string }, { close: () => void }>,
  WSS
]
