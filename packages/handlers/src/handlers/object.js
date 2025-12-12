/**
 * Object Handlers
 *
 * Object manipulation and access operations.
 */

export function registerObject({ registerBuiltin }) {
  registerBuiltin('keys', () => (obj) => Object.keys(obj ?? {}))
  registerBuiltin('values', () => (obj) => Object.values(obj ?? {}))
  registerBuiltin('entries', () => (obj) => Object.entries(obj ?? {}))
  registerBuiltin('fromEntries', () => (arr) => Object.fromEntries(arr ?? []))

  registerBuiltin('get', (ctx) => (obj) => ctx.path.split('.').reduce((o, k) => o?.[k], obj))

  registerBuiltin(
    'has',
    (ctx) => (obj) => ctx.path.split('.').reduce((o, k) => o?.[k], obj) !== undefined
  )

  registerBuiltin(
    'omit',
    (ctx) => (obj) =>
      Object.fromEntries(Object.entries(obj ?? {}).filter(([k]) => !ctx.keys.includes(k)))
  )

  registerBuiltin('defaults', (ctx) => (obj) => ({ ...ctx.defaults, ...(obj ?? {}) }))
  registerBuiltin(
    'merge',
    () =>
      (...objs) =>
        Object.assign({}, ...objs)
  )
}
