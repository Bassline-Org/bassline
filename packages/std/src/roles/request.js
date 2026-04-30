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

export function request(msg) {
  let resolverMsg
  const promise = new Promise((res, rej) => {
    resolverMsg = enrich(msg, [
      [reply, res],
      [reject, rej],
    ])
  })
  return { promise, msg: resolverMsg }
}
