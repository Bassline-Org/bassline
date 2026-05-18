/**
 * @import { Msg, Send, WithCaps } from "@bassline/core"
 */
import { msg, is, failure } from '@bassline/core'
const description = `\
I am a lambda.
I am internally a curried function.
I do not auto curry, so please invoke me 1 arg at a time. :)
I will only accept messages with the caps: resolve + reject.
When you invoke my call cap, I will apply my function to the message
and invoke resolve or reject.

I will always resolve & reject a message with caps.
If the fn returns a function, it will resolve to another lambda msg.
If the fn returns a msg, it will resolve to the msg.
If the fn returns undefined, it will resolve an empty message.
Anything else will reject the message.`

/**
 * @typedef {WithCaps<{ call: Send }>} LambdaMsg
 */

/**
 * Wraps a function as a Msg with a `call` cap. Invoking `call` with a Msg that
 * carries `resolve`/`reject` caps applies `fn` and routes the result.
 * @param {(m: Msg) => unknown} fn
 * @param {Msg} [target]
 * @returns {LambdaMsg}
 */
export function lambda(fn, target = msg()) {
  return target.defaults({ description }).grantCaps({ call })

  /** @param {Msg} aMsg */
  async function call(aMsg) {
    if (!aMsg.capableOf(['resolve', 'reject'])) return
    // we do this to copy the resolve & reject caps for santiary reasons
    const responder = aMsg.copy()
    let transferred = false
    try {
      const result = await fn(aMsg)
      if (is.msg(result)) {
        return responder.invoke('resolve', result)
      }
      if (is.fn(result)) {
        transferred = true
        const m = lambda(/** @type {(m: Msg) => unknown} */ (result)).closedBy(
          target
        )
        return responder.invoke('resolve', m)
      }
      if (is.undefined(result)) {
        return responder.invoke('resolve', msg())
      }
      throw failure(`invalid result: ${JSON.stringify(result)}`)
    } catch (e) {
      if (e instanceof Error) {
        return responder.invoke('reject', msg().merge({ error: e.message }))
      }
      throw e
    } finally {
      responder.close()
      if (!transferred) aMsg.close()
    }
  }
}

/**
 * Grants `resolve` and `reject` caps on aMsg and returns a Promise that
 * settles when either is invoked.
 * @param {Msg} aMsg
 * @returns {Promise<Msg>}
 */
export function withResolver(aMsg) {
  return new Promise((resolve, reject) => {
    aMsg.grantCaps({ resolve, reject })
  })
}

/**
 * Builds a request helper for a given cap spelling.
 * @param {string} spelling
 * @returns {(target: Msg | Promise<Msg>, aMsg?: Msg) => Promise<Msg>}
 */
export const request =
  spelling =>
  async (aTarget, aMsg = msg()) => {
    const promise = withResolver(aMsg)
    const lam = await aTarget
    lam.invoke(spelling, aMsg)
    const result = await promise
    return result
  }

export const call = request('call')
