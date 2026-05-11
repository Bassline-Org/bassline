import type { PortLike, Recv } from '../bassline.js'

export function fromPort(port: MessagePort): [PortLike, Recv]
