import { is } from '@bassline/core'

export const merge = msgs => msgs.reduce((acc, curr) => ({ ...acc, ...curr }))
export const and = (a, b) => value => a(value) && b(value)
export const or = (a, b) => value => a(value) || b(value)

export const equal = (a, b) => a === b
export const memberOf = (elems, item) => elems.includes(item)
export const reducer = (fn, seed) => arr =>
  is.undefined(seed) ? arr.reduce(fn) : arr.reduce(fn, seed)

export const entries = o => Object.entries(o)
export const symbolEntries = o =>
  Object.getOwnPropertySymbols(o).map(sym => [sym, o[sym]])

export class AssertionFailure extends Error {}
export function failure(msg) {
  return new AssertionFailure(msg)
}

export function invariants(preds) {
  function assert(value) {
    for (const [pred, msg = _v => 'assertion failed'] of preds) {
      if (!pred(value)) {
        if (is.fn(msg)) throw failure(msg(value))
        throw failure(msg)
      }
    }
    return value
  }
  assert.test = value => {
    try {
      assert(value)
      return true
    } catch (e) {
      if (e instanceof AssertionFailure) return false
      throw e
    }
  }
  return assert
}

export const ensure = preds => value => preds.every(f => f(value))
export const some = preds => value => preds.some(f => f(value))

export const scalarTypes = ['string', 'boolean', 'symbol', 'number']

export const isScalarType = val =>
  equal(val, null) || memberOf(scalarTypes, typeof val)

export function conforms(description) {
  if (!is.object(description)) {
    throw new Error('conform: invalid description')
  }

  const predicates = [is.object]

  for (const [key, val] of entries(description).concat(
    symbolEntries(description)
  )) {
    if (is.fn(val)) {
      predicates.push(msg => val(msg[key], msg))
      continue
    }
    if (isScalarType(val)) {
      predicates.push(msg => equal(msg[key], val))
      continue
    }
    throw new Error(`conform: unknown descriptor key: ${key}, val: ${val}`)
  }

  return ensure(predicates)
}
