import type { Socket, NetConnectOpts } from 'node:net'
import type { PortLike, Recv } from '../bassline.js'
import type { Frame } from '../frame/jsonl.js'

export function fromSocket(
  socket: Socket,
  frame?: Frame
): [PortLike, Recv]

export function connect(
  options?: NetConnectOpts,
  frame?: Frame
): [PortLike, Recv]
