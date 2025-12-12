/**
 * Collection Handlers
 *
 * Array and object manipulation:
 * - Array access: length, at, head, tail, init, take, drop
 * - Array transform: reverse, sort, sortBy, unique, flatten, compact, chunk
 * - Array aggregates: arraySum, arrayProduct, arrayAverage, arrayMin, arrayMax
 * - Array reducers: sumBy, countBy, groupBy, indexBy, minBy, maxBy, fold, scan
 * - Object access: keys, values, entries, fromEntries, get, has
 * - Object transform: omit, defaults, merge
 */

// Array access

export const length = () => (arr) => (Array.isArray(arr) ? arr.length : null)

export const at = (ctx) => (arr) => arr?.[ctx.index]

export const head = () => (arr) => arr?.[0]

export const tail = () => (arr) => arr?.slice(1)

export const init = () => (arr) => arr?.slice(0, -1)

export const take = (ctx) => (arr) => arr?.slice(0, ctx.count)

export const drop = (ctx) => (arr) => arr?.slice(ctx.count)

// Array transform

export const reverse = () => (arr) => [...(arr || [])].reverse()

export const sort = (ctx) => (arr) =>
  [...(arr || [])].sort(ctx.descending ? (a, b) => b - a : (a, b) => a - b)

export const sortBy = (ctx) => (arr) =>
  [...(arr || [])].sort((a, b) => {
    const va = a?.[ctx.key],
      vb = b?.[ctx.key]
    return ctx.descending ? (vb > va ? 1 : -1) : va > vb ? 1 : -1
  })

export const unique = () => (arr) => [...new Set(arr || [])]

export const flatten = () => (arr) => (arr || []).flat()

export const compact = () => (arr) => (arr || []).filter((x) => x !== null && x !== undefined)

export const chunk = (ctx) => (arr) => {
  const chunks = []
  const a = arr || []
  for (let i = 0; i < a.length; i += ctx.size) {
    chunks.push(a.slice(i, i + ctx.size))
  }
  return chunks
}

// Unary array aggregates (for combinator use)

export const arraySum = () => (arr) => (Array.isArray(arr) ? arr.reduce((a, b) => a + b, 0) : null)

export const arrayProduct = () => (arr) =>
  Array.isArray(arr) ? arr.reduce((a, b) => a * b, 1) : null

export const arrayAverage = () => (arr) =>
  Array.isArray(arr) && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

export const arrayMin = () => (arr) => (Array.isArray(arr) && arr.length ? Math.min(...arr) : null)

export const arrayMax = () => (arr) => (Array.isArray(arr) && arr.length ? Math.max(...arr) : null)

// Array reducers by key

export const sumBy = (ctx) => (arr) => (arr || []).reduce((sum, x) => sum + (x?.[ctx.key] ?? 0), 0)

export const countBy = (ctx) => (arr) =>
  (arr || []).reduce((acc, x) => {
    const k = x?.[ctx.key]
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})

export const groupBy = (ctx) => (arr) =>
  (arr || []).reduce((acc, x) => {
    const k = x?.[ctx.key]
    ;(acc[k] ??= []).push(x)
    return acc
  }, {})

export const indexBy = (ctx) => (arr) =>
  Object.fromEntries((arr || []).map((x) => [x?.[ctx.key], x]))

export const minBy = (ctx) => (arr) =>
  (arr || []).reduce((min, x) => (x?.[ctx.key] < min?.[ctx.key] ? x : min), arr?.[0])

export const maxBy = (ctx) => (arr) =>
  (arr || []).reduce((max, x) => (x?.[ctx.key] > max?.[ctx.key] ? x : max), arr?.[0])

// fold: General array reduction with a binary operation
export const fold = (ctx, opFn) => {
  const { get } = ctx
  const op = opFn || get(ctx.op, ctx.opConfig || {})
  const initialValue = ctx.init
  return (arr) => {
    if (!Array.isArray(arr)) return initialValue
    return arr.reduce((acc, val) => op(acc, val), initialValue)
  }
}

// scan: Like fold but returns all intermediate accumulator values
export const scan = (ctx, opFn) => {
  const { get } = ctx
  const op = opFn || get(ctx.op, ctx.opConfig || {})
  const initialValue = ctx.init
  return (arr) => {
    if (!Array.isArray(arr)) return [initialValue]
    const result = []
    let acc = initialValue
    for (const val of arr) {
      acc = op(acc, val)
      result.push(acc)
    }
    return result
  }
}

// Object access

export const keys = () => (obj) => Object.keys(obj ?? {})

export const values = () => (obj) => Object.values(obj ?? {})

export const entries = () => (obj) => Object.entries(obj ?? {})

export const fromEntries = () => (arr) => Object.fromEntries(arr ?? [])

// Note: This is named 'getPath' to avoid conflict with the 'get' injected into ctx
// But registered as 'get' in the registry for backwards compatibility
export const getPath = (ctx) => (obj) => ctx.path.split('.').reduce((o, k) => o?.[k], obj)

export const has = (ctx) => (obj) => ctx.path.split('.').reduce((o, k) => o?.[k], obj) !== undefined

// Object transform

export const omit = (ctx) => (obj) =>
  Object.fromEntries(Object.entries(obj ?? {}).filter(([k]) => !ctx.keys.includes(k)))

export const defaults = (ctx) => (obj) => ({ ...ctx.defaults, ...(obj ?? {}) })

export const merge =
  () =>
  (...objs) =>
    Object.assign({}, ...objs)
