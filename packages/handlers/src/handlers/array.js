/**
 * Array Handlers
 *
 * Array manipulation and access operations.
 */

export function registerArray({ registerBuiltin }) {
  registerBuiltin('length', () => (arr) => Array.isArray(arr) ? arr.length : null)
  registerBuiltin('at', (ctx) => (arr) => arr?.[ctx.index])
  registerBuiltin('head', () => (arr) => arr?.[0])
  registerBuiltin('tail', () => (arr) => arr?.slice(1))
  registerBuiltin('init', () => (arr) => arr?.slice(0, -1))
  registerBuiltin('reverse', () => (arr) => [...(arr || [])].reverse())

  registerBuiltin('sort', (ctx) => (arr) =>
    [...(arr || [])].sort(ctx.descending ? (a, b) => b - a : (a, b) => a - b)
  )

  registerBuiltin('sortBy', (ctx) => (arr) =>
    [...(arr || [])].sort((a, b) => {
      const va = a?.[ctx.key], vb = b?.[ctx.key]
      return ctx.descending ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1)
    })
  )

  registerBuiltin('unique', () => (arr) => [...new Set(arr || [])])
  registerBuiltin('flatten', () => (arr) => (arr || []).flat())
  registerBuiltin('compact', () => (arr) => (arr || []).filter(x => x != null))
  registerBuiltin('take', (ctx) => (arr) => arr?.slice(0, ctx.count))
  registerBuiltin('drop', (ctx) => (arr) => arr?.slice(ctx.count))

  registerBuiltin('chunk', (ctx) => (arr) => {
    const chunks = []
    const a = arr || []
    for (let i = 0; i < a.length; i += ctx.size) {
      chunks.push(a.slice(i, i + ctx.size))
    }
    return chunks
  })

  // Unary array aggregates (for combinator use)
  registerBuiltin('arraySum', () => (arr) =>
    Array.isArray(arr) ? arr.reduce((a, b) => a + b, 0) : null
  )

  registerBuiltin('arrayProduct', () => (arr) =>
    Array.isArray(arr) ? arr.reduce((a, b) => a * b, 1) : null
  )

  registerBuiltin('arrayAverage', () => (arr) =>
    Array.isArray(arr) && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  )

  registerBuiltin('arrayMin', () => (arr) =>
    Array.isArray(arr) && arr.length ? Math.min(...arr) : null
  )

  registerBuiltin('arrayMax', () => (arr) =>
    Array.isArray(arr) && arr.length ? Math.max(...arr) : null
  )
}
