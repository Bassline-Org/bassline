/**
 * Arithmetic Handlers (Unary)
 *
 * Single-input arithmetic transformations.
 */

export function registerArithmetic({ registerBuiltin }) {
  registerBuiltin('negate', () => (x) => -x)
  registerBuiltin('abs', () => (x) => Math.abs(x))
  registerBuiltin('round', () => (x) => Math.round(x))
  registerBuiltin('floor', () => (x) => Math.floor(x))
  registerBuiltin('ceil', () => (x) => Math.ceil(x))
}
