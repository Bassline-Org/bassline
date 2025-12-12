/**
 * Array Reducer Handlers
 *
 * Reduce arrays by key (sumBy, groupBy, etc.).
 */

export function registerArrayReducers({ registerBuiltin, get }) {
  registerBuiltin(
    'sumBy',
    (ctx) => (arr) => (arr || []).reduce((sum, x) => sum + (x?.[ctx.key] ?? 0), 0)
  )

  registerBuiltin(
    'countBy',
    (ctx) => (arr) =>
      (arr || []).reduce((acc, x) => {
        const k = x?.[ctx.key]
        acc[k] = (acc[k] ?? 0) + 1
        return acc
      }, {})
  )

  registerBuiltin(
    'groupBy',
    (ctx) => (arr) =>
      (arr || []).reduce((acc, x) => {
        const k = x?.[ctx.key]
        ;(acc[k] ??= []).push(x)
        return acc
      }, {})
  )

  registerBuiltin(
    'indexBy',
    (ctx) => (arr) => Object.fromEntries((arr || []).map((x) => [x?.[ctx.key], x]))
  )

  registerBuiltin(
    'minBy',
    (ctx) => (arr) =>
      (arr || []).reduce((min, x) => (x?.[ctx.key] < min?.[ctx.key] ? x : min), arr?.[0])
  )

  registerBuiltin(
    'maxBy',
    (ctx) => (arr) =>
      (arr || []).reduce((max, x) => (x?.[ctx.key] > max?.[ctx.key] ? x : max), arr?.[0])
  )

  // fold: General array reduction with a binary operation
  registerBuiltin('fold', (ctx, opFn) => {
    const op = opFn || get(ctx.op, ctx.opConfig || {})
    const init = ctx.init
    return (arr) => {
      if (!Array.isArray(arr)) return init
      return arr.reduce((acc, val) => op(acc, val), init)
    }
  })

  // scan: Like fold but returns all intermediate accumulator values
  registerBuiltin('scan', (ctx, opFn) => {
    const op = opFn || get(ctx.op, ctx.opConfig || {})
    const init = ctx.init
    return (arr) => {
      if (!Array.isArray(arr)) return [init]
      const result = []
      let acc = init
      for (const val of arr) {
        acc = op(acc, val)
        result.push(acc)
      }
      return result
    }
  })
}
