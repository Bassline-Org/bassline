/**
 * Composition Handlers
 *
 * Higher-order handlers for composing other handlers.
 */

export function registerComposition({ registerBuiltin, get }) {
  // compose: Chain multiple handlers (old API for compatibility)
  registerBuiltin('compose', (ctx) => {
    const handlers = ctx.steps.map((step) => {
      if (typeof step === 'string') {
        return get(step, ctx[step] || {})
      }
      return get(step.handler, step.config || {})
    })
    return (...values) => {
      let result = values.length === 1 ? values[0] : values
      for (const h of handlers) {
        result = Array.isArray(result) ? h(...result) : h(result)
      }
      return result
    }
  })
}
