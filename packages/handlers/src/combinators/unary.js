/**
 * Unary Combinators
 *
 * Combinators that work with single-argument handlers.
 * - pipe: Left-to-right composition
 * - sequence: Run handlers in sequence, return last result
 */

export function registerUnaryCombinators({ registerBuiltin, get }) {
  // pipe: left-to-right composition  pipe(f,g)(x) = g(f(x))
  registerBuiltin('pipe', (ctx, ...compiledArgs) => {
    // If called from compileDefinition, compiledArgs are pre-compiled handlers
    // If called from config, ctx.steps contains handler names
    const handlers =
      compiledArgs.length > 0
        ? compiledArgs
        : (ctx.steps || []).map((step) =>
            typeof step === 'string'
              ? get(step, {})
              : get(step.handler || step[0], step.config || step[1] || {})
          )
    return (x) => handlers.reduce((val, fn) => fn(val), x)
  })

  // sequence: Run handlers in sequence, return last result (like progn)
  // Each handler gets the original input, not the previous output
  registerBuiltin('sequence', (ctx, ...compiledArgs) => {
    const handlers =
      compiledArgs.length > 0
        ? compiledArgs
        : (ctx.steps || []).map((step) =>
            typeof step === 'string'
              ? get(step, {})
              : get(step.handler || step[0], step.config || step[1] || {})
          )
    return (x) => {
      let result = x
      for (const fn of handlers) result = fn(x) // Each gets original x
      return result
    }
  })
}
