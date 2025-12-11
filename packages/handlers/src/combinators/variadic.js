/**
 * Variadic Combinators
 *
 * Combinators that work with multiple handlers.
 * - converge: Multiple branches combined  converge(f, [g,h])(x) = f(g(x), h(x))
 */

export function registerVariadicCombinators({ registerBuiltin, get }) {
  // converge: Multiple branches combined  converge(f, [g,h])(x) = f(g(x), h(x))
  registerBuiltin('converge', (ctx, combiner, ...branches) => {
    const combinerFn = combiner || get(ctx.combiner?.handler || ctx.combiner, ctx.combiner?.config || {})
    const branchFns = branches.length > 0
      ? branches
      : (ctx.branches || []).map(b =>
          typeof b === 'string' ? get(b, {}) : get(b.handler, b.config || {})
        )
    return (x) => combinerFn(...branchFns.map(fn => fn(x)))
  })
}
