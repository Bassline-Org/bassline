import { Cap, fault, hasCap, Message, offer, Send } from '@bassline/core'

export const RESOLVE = Symbol.for('promise.resolve')
export const REJECT = Symbol.for('promise.reject')

export function isPromiseCap(msg: Message): msg is Cap<typeof RESOLVE> & Cap<typeof REJECT> {
  return hasCap(msg, RESOLVE) && hasCap(msg, REJECT)
}

export function ask(dest: Send, msg: Message, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(fault('timeout', msg, { dest })), timeout)
    const p = offer({
      [RESOLVE]: res => {
        clearTimeout(timer)
        resolve(res)
      },
      [REJECT]: err => {
        clearTimeout(timer)
        reject(err)
      },
    })
    p.to(dest)
    p.send(msg)
  })
}
