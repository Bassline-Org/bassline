/**
 * Conditional Handlers
 *
 * Branching and filtering based on predicates.
 */

export function registerConditional({ registerBuiltin, get }) {
  // filter: Returns undefined to skip propagation if predicate fails
  // 'when' is an alias for filter
  registerBuiltin('filter', (ctx) => {
    const predHandler = get(ctx.handler, ctx.config || {})
    if (!predHandler) throw new Error(`filter: unknown handler '${ctx.handler}'`)
    return (value) => (predHandler(value) ? value : undefined)
  })

  // when: Alias for filter (kept for compatibility)
  registerBuiltin('when', (ctx) => {
    const predHandler = get(ctx.handler, ctx.config || {})
    if (!predHandler) throw new Error(`when: unknown handler '${ctx.handler}'`)
    return (value) => (predHandler(value) ? value : undefined)
  })

  registerBuiltin('ifElse', (ctx) => {
    const pred = get(ctx.predicate.handler, ctx.predicate.config || {})
    const thenH = get(ctx.then.handler, ctx.then.config || {})
    const elseH = get(ctx.else.handler, ctx.else.config || {})
    return (value) => (pred(value) ? thenH(value) : elseH(value))
  })

  registerBuiltin('cond', (ctx) => (value) => {
    for (const { when, then } of ctx.cases) {
      const pred = get(when.handler, when.config || {})
      if (pred(value)) {
        return get(then.handler, then.config || {})(value)
      }
    }
    return ctx.default ? get(ctx.default.handler, ctx.default.config || {})(value) : value
  })
}
