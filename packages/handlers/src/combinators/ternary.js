/**
 * Ternary Combinators
 *
 * Combinators that work with three handlers.
 * - fork: APL fork  fork(f,g,h)(x) = g(f(x), h(x))
 */

export function registerTernaryCombinators({ registerBuiltin, get }) {
  // fork: APL fork  fork(f,g,h)(x) = g(f(x), h(x))
  // Left and right branches produce values, middle combines them
  registerBuiltin('fork', (ctx, left, middle, right) => {
    // Validate argument count when using compiled args
    if (left !== undefined && (middle === undefined || right === undefined)) {
      throw new Error('fork requires exactly 3 handlers: left, middle, right')
    }
    const leftFn = left || get(ctx.left, {})
    const middleFn = middle || get(ctx.middle, {})
    const rightFn = right || get(ctx.right, {})
    return (x) => middleFn(leftFn(x), rightFn(x))
  })
}
