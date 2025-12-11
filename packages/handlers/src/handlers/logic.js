/**
 * Logic Handlers
 *
 * Boolean operations.
 */

export function registerLogic({ registerBuiltin }) {
  registerBuiltin('and', () => (...values) => values.every(Boolean))
  registerBuiltin('or', () => (...values) => values.some(Boolean))
  registerBuiltin('not', () => (x) => !x)
  registerBuiltin('xor', () => (a, b) => Boolean(a) !== Boolean(b))
}
