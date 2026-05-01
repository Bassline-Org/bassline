/**
 * @import { Send, Close, Message } from "@bassline/core"
 */
import { is } from '@bassline/core'
import { Role } from './role.js'
import { send, close, enrich } from '../caps.js'
import { conforms, invariants } from '../shape.js'

export class PortLike extends Role {
  static requires = [send, close]
  send(msg) {
    send.invoke(this.msg, msg)
  }
  init(msg) {
    super.init(msg)
    this.ctl.onClose(() => close.invoke(this.msg, {}))
  }
}

export const assertPortShaped = invariants([
  [conforms({ send: is.fn, close: is.fn }), 'not port shaped'],
])

/**
 *
 * @param {Message} msg
 * @param {{send: Send, close: Close}} port
 */
export function advertise(msg, port) {
  assertPortShaped(port)
  return enrich(msg, [
    [send, port.send],
    [close, port.close],
  ])
}
