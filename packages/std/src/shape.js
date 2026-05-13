/**
 * @import { Msg, HasCaps } from "@bassline/core"
 */
import { is } from '@bassline/core'

export const and = (a, b) => value => a(value) && b(value)
export const or = (a, b) => value => a(value) || b(value)
export const equal = (a, b) => a === b
export const memberOf = (elems, item) => elems.includes(item)
export const reducer = (fn, seed) => arr =>
  is.undefined(seed) ? arr.reduce(fn) : arr.reduce(fn, seed)

/**
 * @type {<S extends string>(spelling: S) =>
 * (a: HasCaps<S>) => (b: Msg) => void}
 */
const invokeMsg = spelling => a => b => a.invoke(spelling, b)

/**
 *
 * @param {string | (readonly string[])} spelling
 */
export const invoke = spelling => {
  if (is.array(spelling)) {
    return spelling.map(s => {
      return [s, invokeMsg(s)]
    })
  }
  return invokeMsg(spelling)
}

export const { resolve, reject } = invoke(['resolve', 'reject'])
