/**
 * Special Combinators
 *
 * Special-purpose combinators with unique signatures.
 * - K: Constant combinator  K(c)(x) = c
 * - duplicate: Apply argument twice  W(f)(x) = f(x,x)
 */

export function registerSpecialCombinators({ registerBuiltin, get }) {
  // K (constant combinator): Always return a fixed value  K(c)(x) = c
  // This is distinct from 'constant' which takes config.value
  registerBuiltin('K', (ctx) => () => ctx.value)

  // duplicate: Apply argument twice  W(f)(x) = f(x,x)
  // Also known as the W combinator
  registerBuiltin('duplicate', (ctx, fn) => {
    const innerFn = fn || get(ctx.handler, ctx.config || {})
    return (x) => innerFn(x, x)
  })
}
