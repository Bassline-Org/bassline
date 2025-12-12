/**
 * Type Checking Handlers
 *
 * Type inspection and validation.
 */

export const isNull = () => (x) => x === null || x === undefined

export const isNumber = () => (x) => typeof x === 'number'

export const isString = () => (x) => typeof x === 'string'

export const isArray = () => (x) => Array.isArray(x)

export const isObject = () => (x) => x !== null && typeof x === 'object' && !Array.isArray(x)

export const typeOf = () => (x) => (Array.isArray(x) ? 'array' : x === null ? 'null' : typeof x)
