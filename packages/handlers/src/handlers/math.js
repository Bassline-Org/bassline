/**
 * Math Handlers
 *
 * Arithmetic operations:
 * - Reducers: sum, product, min, max, average, concat, first, last
 * - Binary ops: add, subtract, multiply, divide, modulo, power
 * - Unary: negate, abs, round, floor, ceil
 */

// Reducers - variadic operations that reduce multiple values to one

export const sum =
  () =>
  (...values) =>
    values.reduce((a, b) => (a ?? 0) + (b ?? 0), 0)

export const product =
  () =>
  (...values) =>
    values.reduce((a, b) => (a ?? 1) * (b ?? 1), 1)

export const min =
  () =>
  (...values) => {
    const nums = values.filter((v) => typeof v === 'number')
    return nums.length ? Math.min(...nums) : null
  }

export const max =
  () =>
  (...values) => {
    const nums = values.filter((v) => typeof v === 'number')
    return nums.length ? Math.max(...nums) : null
  }

export const average =
  () =>
  (...values) => {
    const nums = values.filter((v) => typeof v === 'number')
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
  }

export const concat =
  () =>
  (...values) => {
    if (Array.isArray(values[0])) return values.flat()
    return values.filter((v) => v !== null && v !== undefined).join('')
  }

export const first =
  () =>
  (...values) =>
    values.find((v) => v !== null && v !== undefined)

export const last =
  () =>
  (...values) =>
    values.filter((v) => v !== null && v !== undefined).pop()

// Binary operations - two-input arithmetic

export const add = () => (a, b) => (a ?? 0) + (b ?? 0)

export const subtract = () => (a, b) => (a ?? 0) - (b ?? 0)

export const multiply = () => (a, b) => (a ?? 1) * (b ?? 1)

export const divide = () => (a, b) => (b === 0 ? null : (a ?? 0) / b)

export const modulo = () => (a, b) => (b !== 0 ? a % b : null)

export const power = () => (a, b) => Math.pow(a, b)

// Unary arithmetic transformations

export const negate = () => (x) => -x

export const abs = () => (x) => Math.abs(x)

export const round = () => (x) => Math.round(x)

export const floor = () => (x) => Math.floor(x)

export const ceil = () => (x) => Math.ceil(x)
