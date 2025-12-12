/**
 * String Handlers
 *
 * String manipulation operations.
 */

export const split = (ctx) => (s) => String(s).split(ctx.delimiter ?? ',')

export const join = (ctx) => (arr) => arr.join(ctx.delimiter ?? ',')

export const trim = () => (s) => String(s).trim()

export const uppercase = () => (s) => String(s).toUpperCase()

export const lowercase = () => (s) => String(s).toLowerCase()

export const strSlice = (ctx) => (s) => String(s).slice(ctx.start ?? 0, ctx.end)

export const replace = (ctx) => (s) =>
  String(s).replace(new RegExp(ctx.pattern, ctx.flags ?? ''), ctx.replacement ?? '')

export const match = (ctx) => (s) => String(s).match(new RegExp(ctx.pattern, ctx.flags ?? ''))

export const startsWith = (ctx) => (s) => String(s).startsWith(ctx.prefix)

export const endsWith = (ctx) => (s) => String(s).endsWith(ctx.suffix)

export const includes = (ctx) => (s) => String(s).includes(ctx.substring)
