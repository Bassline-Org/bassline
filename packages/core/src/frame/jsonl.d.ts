import type { Msg, PortLike, Send, Fwd } from '../bassline'

export interface Frame {
  reader(): [
    PortLike<{ send: Send<Msg<{ scalar: string }>> }>,
    Fwd
  ]
  format(msg: Msg): string
}

export const reader: Frame['reader']
export const format: Frame['format']

declare const _default: Frame
export default _default
