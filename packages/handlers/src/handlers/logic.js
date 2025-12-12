/**
 * Logic Handlers
 *
 * Boolean operations and comparisons:
 * - Boolean: and, or, not, xor
 * - Comparison: eq, neq, gt, gte, lt, lte, deepEq
 */

// Boolean operations

export const and =
  () =>
  (...values) =>
    values.every(Boolean)

export const or =
  () =>
  (...values) =>
    values.some(Boolean)

export const not = () => (x) => !x

export const xor = () => (a, b) => Boolean(a) !== Boolean(b)

// Comparison operations
// Support both two-input mode and config-based single-input mode

export const eq = (ctx) => (a, b) => a === (b ?? ctx.value)

export const neq = (ctx) => (a, b) => a !== (b ?? ctx.value)

export const gt = (ctx) => (a, b) => a > (b ?? ctx.value)

export const gte = (ctx) => (a, b) => a >= (b ?? ctx.value)

export const lt = (ctx) => (a, b) => a < (b ?? ctx.value)

export const lte = (ctx) => (a, b) => a <= (b ?? ctx.value)

export const deepEq = (ctx) => (a, b) => {
  const cmp = b ?? ctx.value
  return JSON.stringify(a) === JSON.stringify(cmp)
}
