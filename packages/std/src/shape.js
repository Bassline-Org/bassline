import { is } from '@bassline/core'

/**
 * @template T
 * @param {(v: T) => boolean} a
 * @param {(v: T) => boolean} b
 * @returns {(v: T) => boolean}
 */
export const and = (a, b) => value => a(value) && b(value)

/**
 * @template T
 * @param {(v: T) => boolean} a
 * @param {(v: T) => boolean} b
 * @returns {(v: T) => boolean}
 */
export const or = (a, b) => value => a(value) || b(value)

/**
 * @template T
 * @param {T} a
 * @param {T} b
 * @returns {boolean}
 */
export const equal = (a, b) => a === b

/**
 * @template T
 * @param {readonly T[]} elems
 * @param {T} item
 * @returns {boolean}
 */
export const memberOf = (elems, item) => elems.includes(item)

/**
 * @template T, U
 * @param {(acc: U, v: T) => U} fn
 * @param {U} [seed]
 * @returns {(arr: T[]) => U}
 */
export const reducer = (fn, seed) => arr =>
  is.undefined(seed)
    ? /** @type {U} */ (
        /** @type {unknown} */ (arr.reduce(/** @type {any} */ (fn)))
      )
    : arr.reduce(fn, seed)
