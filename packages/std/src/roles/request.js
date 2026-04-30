import { Role } from './role.js'
import { reply, reject, enrich } from '../caps.js'
import { scalar } from '../data/scalar.js'

export class Request extends Role {
  static requires = [reply, reject]
  resolved
  init(msg) {
    super.init(msg)
    this.onClose(() => {
      if (!this.resolved) this.reject(scalar('closed'))
    })
  }
  reply(val) {
    if (this.resolved) return
    reply.invoke(this.msg, val)
    this.resolved = true
    this.close()
  }
  reject(val) {
    if (this.resolved) return
    reject.invoke(this.msg, val)
    this.resolved = true
    this.close()
  }
  resolve(val) {
    this.reply(val)
  }
}

export function requester({ send }) {
  return async aMessage => {
    const { promise, msg } = createRequest(aMessage)
    send(msg)
    const result = await promise
    return result
  }
}

export function createRequest(aMsg) {
  let msg
  const promise = new Promise((res, rej) => {
    msg = enrich(aMsg, [
      [reply, res],
      [reject, rej],
    ])
  })
  return { promise, msg }
}
