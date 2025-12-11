/**
 * Reducer Handlers
 *
 * Variadic handlers that reduce multiple values to one.
 * - sum, product: arithmetic reductions
 * - min, max, average: statistical
 * - concat, first, last: sequence operations
 */

export function registerReducers({ registerBuiltin }) {
  registerBuiltin('sum', () => (...values) =>
    values.reduce((a, b) => (a ?? 0) + (b ?? 0), 0)
  )

  registerBuiltin('product', () => (...values) =>
    values.reduce((a, b) => (a ?? 1) * (b ?? 1), 1)
  )

  registerBuiltin('min', () => (...values) => {
    const nums = values.filter(v => typeof v === 'number')
    return nums.length ? Math.min(...nums) : null
  })

  registerBuiltin('max', () => (...values) => {
    const nums = values.filter(v => typeof v === 'number')
    return nums.length ? Math.max(...nums) : null
  })

  registerBuiltin('average', () => (...values) => {
    const nums = values.filter(v => typeof v === 'number')
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
  })

  registerBuiltin('concat', () => (...values) => {
    if (Array.isArray(values[0])) return values.flat()
    return values.filter(v => v != null).join('')
  })

  registerBuiltin('first', () => (...values) =>
    values.find(v => v != null)
  )

  registerBuiltin('last', () => (...values) =>
    values.filter(v => v != null).pop()
  )
}
