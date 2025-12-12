/**
 * Binary Operation Handlers
 *
 * Two-input arithmetic operations.
 * Consolidated from duplicates in original propagator.js.
 */

export function registerBinaryOps({ registerBuiltin }) {
  // Safe binary operations (handle nulls)
  registerBuiltin('add', () => (a, b) => (a ?? 0) + (b ?? 0))
  registerBuiltin('multiply', () => (a, b) => (a ?? 1) * (b ?? 1))
  registerBuiltin('subtract', () => (a, b) => (a ?? 0) - (b ?? 0))
  registerBuiltin('divide', () => (a, b) => (b === 0 ? null : (a ?? 0) / b))
  registerBuiltin('modulo', () => (a, b) => (b !== 0 ? a % b : null))
  registerBuiltin('power', () => (a, b) => Math.pow(a, b))
}
