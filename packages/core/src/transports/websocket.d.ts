import type { PortLike, Recv } from '../bassline.js'

export function fromWebSocket(ws: WebSocket): [PortLike, Recv]
