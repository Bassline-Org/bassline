export const isArray = v => Array.isArray(v)
export const isNil = obj => obj === undefined || obj === null
export const isPromise = obj => obj instanceof Promise
export const panic = msg => {
  throw new Error(msg)
}
export const maybeThen = (value, fn) => {
  if (value instanceof Promise) {
    return value.then(fn)
  } else {
    return fn(value)
  }
}

export const assert =
  pred =>
    (...args) => {
      if (!pred(...args)) {
        throw new Error('assertion failed!')
      }
    }

export const hasKeys = (obj, keys = []) => {
  if (isNil(obj)) return false
  const requiredKeys = isArray(keys) ? keys : [keys],
    objectKeys = new Set(Object.keys(obj))

  return requiredKeys.every(key => objectKeys.has(key))
}

export const isPlainObject = obj =>
  obj !== null
  && typeof obj === 'object'
  && !Array.isArray(obj)
  && Object.getPrototypeOf(obj) === Object.prototype

export const send =
  aResource =>
    (msg = {}) => {
      if (hasKeys(msg, 'put')) {
        const { put, ...rest } = msg
        return aResource.put(put, rest)
      } else {
        return aResource.get(msg)
      }
    }

export default {
  isArray,
  isNil,
  isPromise,
  isPlainObject,
  hasKeys,
  send,
  panic,
  maybeThen
}