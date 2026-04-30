//@ts-check
import { hasCap } from '@bassline/core'

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
@import { Message, Send } from '@bassline/core'
@typedef {ReturnType<typeof createCap>} Cap
@param {string} spelling
 */
export function createCap(spelling) {
  const symbol = Symbol.for(spelling)

  /**
   * @param {Message} msg
   * @returns {boolean}
   */
  function check(msg) {
    return hasCap(msg, symbol)
  }

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

  return { symbol, grant, invoke, check }
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
 * Cap for explicit cancellation, similar to reject
 */
export const cancel = createCap('bassline/cancel/1')

/**
 * Cap to close a controller
 */
export const close = createCap('bassline/close/1')

/**
 * Cap for an arbtirary send
 */
export const send = createCap('bassline/send/1')

/**
 * Cap for keep-alive style messages
 */
export const ping = createCap('bassline/ping/1')

/**
 * Cap to pass a port like message through
 */
export const connect = createCap('bassline/connect/1')

/**
 * Cap to pass a request shaped message through
 */
export const request = createCap('bassline/request/1')
