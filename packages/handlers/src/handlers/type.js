/**
 * Type Checking Handlers
 *
 * Type inspection and validation.
 */

export function registerType({ registerBuiltin }) {
  registerBuiltin('isNull', () => (x) => x === null || x === undefined)
  registerBuiltin('isNumber', () => (x) => typeof x === 'number')
  registerBuiltin('isString', () => (x) => typeof x === 'string')
  registerBuiltin('isArray', () => (x) => Array.isArray(x))
  registerBuiltin('isObject', () => (x) => x !== null && typeof x === 'object' && !Array.isArray(x))
  registerBuiltin(
    'typeOf',
    () => (x) => (Array.isArray(x) ? 'array' : x === null ? 'null' : typeof x)
  )
}
