/** @param {unknown} v */
export const isArray = v => Array.isArray(v)

/** @param {unknown} obj */
export const isNil = obj => obj === undefined || obj === null

/** @param {unknown} obj */
export const isPromise = obj => obj instanceof Promise

/**
 * @param {string} msg
 * @returns {never}
 */
export const panic = msg => {
  throw new Error(msg)
}

/**
 * If value is a Promise, chain fn via .then(); otherwise call fn synchronously.
 * @template T, U
 * @param {T | Promise<T>} value
 * @param {(v: T) => U} fn
 * @returns {U | Promise<U>}
 */
export const maybeThen = (value, fn) => {
  if (value instanceof Promise) {
    return value.then(fn)
  } else {
    return fn(value)
  }
}

/**
 * Returns a function that throws if the predicate fails.
 * @param {(...args: unknown[]) => boolean} pred
 * @returns {(...args: unknown[]) => void}
 */
export const assert =
  pred =>
  (...args) => {
    if (!pred(...args)) {
      throw new Error('assertion failed!')
    }
  }

/**
 * Check whether obj has all of the specified keys.
 * @param {unknown} obj
 * @param {string | string[]} [keys]
 * @returns {boolean}
 */
export const hasKeys = (obj, keys = []) => {
  if (isNil(obj)) return false
  const requiredKeys = isArray(keys) ? keys : [keys],
    objectKeys = new Set(Object.keys(obj))

  return requiredKeys.every(key => objectKeys.has(key))
}

/**
 * True if obj is a plain object (created by {} or Object.create(null)).
 * @param {unknown} obj
 * @returns {boolean}
 */
export const isPlainObject = obj =>
  obj !== null && typeof obj === 'object' && !Array.isArray(obj) && Object.getPrototypeOf(obj) === Object.prototype

/**
 * Create a dispatcher function for a Resource instance.
 * @param {import('./types').Resource} aResource
 * @returns {import('./types').ResourceFn}
 */
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
  maybeThen,
}
