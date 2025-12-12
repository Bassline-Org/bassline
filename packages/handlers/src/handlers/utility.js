/**
 * Utility Handlers
 *
 * General-purpose utility handlers.
 */

export function registerUtility({ registerBuiltin }) {
  // identity: Pass through unchanged
  registerBuiltin('identity', () => (x) => x)

  // passthrough: Alias for identity
  registerBuiltin('passthrough', () => (x) => x)

  // constant: Always return configured value (used via config)
  registerBuiltin('constant', (ctx) => () => ctx.value)

  // always: Alias for constant
  registerBuiltin('always', (ctx) => () => ctx.value)

  // tap: Log value and pass through
  registerBuiltin('tap', (ctx) => (x) => {
    console.log(ctx.label ?? 'tap', x)
    return x
  })

  // defaultTo: Replace null/undefined with default
  registerBuiltin('defaultTo', (ctx) => (x) => x ?? ctx.value)

  // format: Template string replacement
  registerBuiltin(
    'format',
    (ctx) =>
      (...values) =>
        ctx.template.replace(/\{(\d+)\}/g, (_, i) => values[i] ?? '')
  )

  // coerce: Type conversion
  registerBuiltin('coerce', (ctx) => (value) => {
    switch (ctx.to) {
      case 'number':
        return Number(value) || 0
      case 'string':
        return String(value ?? '')
      case 'boolean':
        return Boolean(value)
      case 'json':
        return typeof value === 'string' ? JSON.parse(value) : value
      default:
        return value
    }
  })
}
