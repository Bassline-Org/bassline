/**
 * String Handlers
 *
 * String manipulation operations.
 */

export function registerString({ registerBuiltin }) {
  registerBuiltin('split', (ctx) => (s) => String(s).split(ctx.delimiter ?? ','))
  registerBuiltin('join', (ctx) => (arr) => arr.join(ctx.delimiter ?? ','))
  registerBuiltin('trim', () => (s) => String(s).trim())
  registerBuiltin('uppercase', () => (s) => String(s).toUpperCase())
  registerBuiltin('lowercase', () => (s) => String(s).toLowerCase())
  registerBuiltin('strSlice', (ctx) => (s) => String(s).slice(ctx.start ?? 0, ctx.end))

  registerBuiltin('replace', (ctx) => (s) =>
    String(s).replace(new RegExp(ctx.pattern, ctx.flags ?? ''), ctx.replacement ?? '')
  )

  registerBuiltin('match', (ctx) => (s) =>
    String(s).match(new RegExp(ctx.pattern, ctx.flags ?? ''))
  )

  registerBuiltin('startsWith', (ctx) => (s) => String(s).startsWith(ctx.prefix))
  registerBuiltin('endsWith', (ctx) => (s) => String(s).endsWith(ctx.suffix))
  registerBuiltin('includes', (ctx) => (s) => String(s).includes(ctx.substring))
}
