/** @param {unknown} v */
export const isArray = v => Array.isArray(v)

/** @param {unknown} obj */
export const isNil = obj => obj == null

/** @param {unknown} obj */
export const isPromise = obj => obj instanceof Promise

export const isNumber = v => typeof v === 'number'
export const isString = v => typeof v === 'string'
export const isFunction = v => typeof v === 'function'

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
export const isPlainObject = obj => {
  if (obj == null) return false;
  if (typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return false;
  return Object.getPrototypeOf(obj) === Object.prototype;
}


export default {
  isArray,
  isNil,
  isPromise,
  isPlainObject,
  hasKeys,
  panic,
  maybeThen,
}