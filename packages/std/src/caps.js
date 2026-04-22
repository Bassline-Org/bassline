//@ts-check
import { hasCap } from '@bassline/core'

/**
@import { Message, Send } from '@bassline/core'
@typedef {ReturnType<typeof createCap>} Cap
@param {string} spelling
 */
export function createCap(spelling) {
  const symbol = Symbol.for(spelling)

  /**
   * @param {Message} msg
   * @param {Send} fn
   * @returns {Message}
   */
  function grant(msg, fn) {
    return {
      ...msg,
      /**@type Send */
      [symbol]: m => void fn(m),
    }
  }

  /**
  @param {Message} msg
  @param {Message} arg
  @returns {void}
   */
  function invoke(msg, arg) {
    if (hasCap(msg, symbol)) {
      return void msg[symbol](arg)
    }
  }

  return { symbol, grant, invoke }
}

/**
 * Cap for request/response semantics on a message
 * Logically similar to Promise.resolve
 * @see {@link reject}
 */
export const reply = createCap('bassline/reply/1')

/**
 * Cap for request/response rejection on a message
 * Logically similar to Promise.reject
 * @see {@link reply}
 */
export const reject = createCap('bassline/reject/1')

/**
 * Cap for request/response rejection on a message
 * Logically similar to Promise.reject
 * @see {@link reply}
 */
export const cancel = createCap('bassline/cancel/1')

export const close = createCap('bassline/close/1')
export const send = createCap('bassline/send/1')

/**
 * @param {Message} msg
 * @param {Array<[Cap, Send]>} handlers
 */
export function enrich(msg, handlers) {
  let m = msg
  for (const [cap, fn] of handlers) {
    m = cap.grant(m, fn)
  }
  return m
}

/**
 * Invokes a send, with caps reply and reject bound to the resolve & reject of a promise
 * @param {{send: Send}} target
 * @param {Message} msg
 * @returns {Promise<unknown>}
 */
export const call = (target, msg) =>
  new Promise((res, rej) => {
    target.send(
      enrich(msg, [
        [reply, res],
        [reject, rej],
      ])
    )
  })
