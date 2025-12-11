/**
 * Binary Combinators
 *
 * Combinators that work with two-argument handlers.
 * - hook: APL hook  hook(f,g)(x) = f(x, g(x))
 * - both: Run two handlers, return pair  both(f,g)(x) = [f(x), g(x)]
 * - flip: Swap arguments  flip(f)(x,y) = f(y,x)
 */

export function registerBinaryCombinators({ registerBuiltin, get }) {
  // hook: APL hook  hook(f,g)(x) = f(x, g(x))
  registerBuiltin('hook', (ctx, binary, transform) => {
    // Validate argument count when using compiled args
    if (binary !== undefined && transform === undefined) {
      throw new Error('hook requires exactly 2 handlers: binary, transform')
    }
    const binaryFn = binary || get(ctx.binary, {})
    const transformFn = transform || get(ctx.transform, {})
    return (x) => binaryFn(x, transformFn(x))
  })

  // both: Run two handlers and return pair  both(f,g)(x) = [f(x), g(x)]
  registerBuiltin('both', (ctx, left, right) => {
    // Validate argument count when using compiled args
    if (left !== undefined && right === undefined) {
      throw new Error('both requires exactly 2 handlers: left, right')
    }
    const leftFn = left || get(ctx.left, {})
    const rightFn = right || get(ctx.right, {})
    return (x) => [leftFn(x), rightFn(x)]
  })

  // flip: Swap arguments  flip(f)(x,y) = f(y,x)
  registerBuiltin('flip', (ctx, fn) => {
    const innerFn = fn || get(ctx.handler, ctx.config || {})
    return (x, y) => innerFn(y, x)
  })
}
