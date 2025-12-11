/**
 * Comparison Handlers
 *
 * Equality and ordering comparisons.
 * Support both two-input mode and config-based single-input mode.
 */

export function registerComparison({ registerBuiltin }) {
  registerBuiltin('eq', (ctx) => (a, b) => a === (b ?? ctx.value))
  registerBuiltin('neq', (ctx) => (a, b) => a !== (b ?? ctx.value))
  registerBuiltin('gt', (ctx) => (a, b) => a > (b ?? ctx.value))
  registerBuiltin('gte', (ctx) => (a, b) => a >= (b ?? ctx.value))
  registerBuiltin('lt', (ctx) => (a, b) => a < (b ?? ctx.value))
  registerBuiltin('lte', (ctx) => (a, b) => a <= (b ?? ctx.value))

  registerBuiltin('deepEq', (ctx) => (a, b) => {
    const cmp = b ?? ctx.value
    return JSON.stringify(a) === JSON.stringify(cmp)
  })
}
