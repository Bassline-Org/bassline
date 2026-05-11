import type { PortLike, Recv } from '../bassline.js'
import type { Frame } from '../frame/jsonl.js'

export function fromStdio(frame?: Frame): [PortLike, Recv]
