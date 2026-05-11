import type { Server, ListenOptions } from 'node:net'
import type { Msg, PortLike, Recv } from '../bassline.js'
import type { Frame } from '../frame/jsonl.js'

export type Connection = [PortLike, Recv]
export type OnConnect = (conn: Connection) => void

export function serve(
  onConnect: OnConnect,
  options?: ListenOptions,
  frame?: Frame
): [
  Msg<
    { description: string, options: ListenOptions },
    { close: () => void }
  >,
  Server
]
