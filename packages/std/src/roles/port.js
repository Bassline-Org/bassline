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

export function portLike(msg, port) {
  assertPortShaped(port)
  return enrich(msg, [
    [send, port.send],
    [close, port.close],
  ])
}
