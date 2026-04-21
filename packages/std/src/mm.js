import { is } from '@bassline/core'

export class KeyNotFound extends Error {
  constructor(key, keys) {
    super(`Key not found: ${key}! Available keys: ${keys}`)
  }
}
export class InvalidMethod extends Error {
  constructor(fn) {
    super(`Invalid Method: ${fn}, must be a function!`)
  }
}
export class InvalidKey extends Error {
  constructor(key) {
    super(`Invalid Key: ${key}, must be a scalar!`)
  }
}

export function multi(dispatchFn) {
  const cases = {}
  function lookup(key) {
    const match = cases[key] ?? cases['default']
    if (match) return match
    throw new KeyNotFound(key)
  }
  function invoke(...args) {
    const key = dispatchFn(...args)
    const match = lookup(key)
    return match(...args)
  }
  invoke.method = (key, fn = null) => {
    if (fn === null) {
      delete cases[key]
      return invoke
    }
    if (!is.fn(fn)) {
      throw new InvalidMethod(fn)
    }
    switch (true) {
      case is.number(key):
      case is.nil(key):
      case is.string(key):
      case is.boolean(key):
      case is.symbol(key):
        cases[key] = fn
        return invoke
      default:
        throw new InvalidKey(key)
    }
  }
  invoke.methods = entries => {
    entries.forEach(([k, fn]) => invoke.method(k, fn))
    return invoke
  }
  invoke.cases = cases

  return invoke
}
