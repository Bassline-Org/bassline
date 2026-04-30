import { is } from '@bassline/core'
import { Role } from './role.js'
import { ping, enrich } from '../caps.js'
import { invariants } from '../shape.js'

export class Ping extends Role {
  static requires = [ping]
  ping() {
    ping.invoke(this.msg, {})
  }
}

export const assertOnPing = invariants([[is.fn, 'onPing must be a fn']])

export function pingMe(msg, onPing) {
  assertOnPing(onPing)
  return enrich(msg, [[ping, onPing]])
}
