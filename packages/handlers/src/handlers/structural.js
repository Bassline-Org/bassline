/**
 * Structural Handlers
 *
 * Combine and reshape data structures.
 */

export function registerStructural({ registerBuiltin, get }) {
  // pair: Combine inputs into array
  registerBuiltin(
    'pair',
    () =>
      (...values) =>
        values
  )

  // zip: Combine inputs into object with named keys
  registerBuiltin('zip', (ctx) => (...values) => {
    const keys = ctx.keys || values.map((_, i) => `v${i}`)
    return Object.fromEntries(keys.map((k, i) => [k, values[i]]))
  })

  // unzip: Extract a key from object
  registerBuiltin('unzip', (ctx) => (obj) => obj?.[ctx.key])

  // pick: Extract a key (alias for unzip)
  registerBuiltin('pick', (ctx) => (obj) => obj?.[ctx.key])

  // map: Apply handler to each element (or single value)
  registerBuiltin('map', (ctx) => {
    const innerHandler = get(ctx.handler, ctx.config || {})
    if (!innerHandler) throw new Error(`map: unknown handler '${ctx.handler}'`)
    return (collection) => {
      if (!Array.isArray(collection)) return innerHandler(collection)
      return collection.map((item) => innerHandler(item))
    }
  })
}
