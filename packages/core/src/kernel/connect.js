/** Well-known symbol for resource identity. */
export const kResource = Symbol.for('bassline.resource')

/**
 * Wire a grammar to a backend, producing a resource function.
 *
 * @param {import('./grammar.js').Grammar} grammar
 * @param {object} impl - Backend instance
 * @returns {(msg?: unknown) => unknown}
 */
export function connect(grammar, impl) {
  const fn = (msg = {}) => grammar.dispatch(msg, impl)
  fn[kResource] = impl
  return fn
}
