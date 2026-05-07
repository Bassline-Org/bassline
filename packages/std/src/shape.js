import { is } from '@bassline/core'

export const and = (a, b) => value => a(value) && b(value)
export const or = (a, b) => value => a(value) || b(value)
export const equal = (a, b) => a === b
export const memberOf = (elems, item) => elems.includes(item)
export const reducer = (fn, seed) => arr =>
  is.undefined(seed) ? arr.reduce(fn) : arr.reduce(fn, seed)

export const invoke = spelling => {
  if (is.array(spelling)) {
    return Object.fromEntries(spelling.map(s => [s, invoke(s)]))
  }
  return aMsg => anotherMsg => aMsg.invoke(spelling, anotherMsg)
}

export const { resolve, reject } = invoke(['resolve', 'reject'])
