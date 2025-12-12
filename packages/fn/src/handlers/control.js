/**
 * Control Functions
 *
 * Control flow, structural transformations, and utility operations:
 * - Conditional: filter, when, ifElse, cond
 * - Structural: pair, zip, unzip, pick, map
 * - Composition: compose
 * - Utility: identity, passthrough, constant, always, tap, defaultTo, format, coerce
 */

// Conditional handlers

export const filter = (ctx) => {
  const { get } = ctx
  const predFn = get(ctx.fn, ctx.fnConfig || {})
  if (!predFn) throw new Error(`filter: unknown fn '${ctx.fn}'`)
  return (value) => (predFn(value) ? value : undefined)
}

// when: Alias for filter (kept for compatibility)
export const when = (ctx) => {
  const { get } = ctx
  const predFn = get(ctx.fn, ctx.fnConfig || {})
  if (!predFn) throw new Error(`when: unknown fn '${ctx.fn}'`)
  return (value) => (predFn(value) ? value : undefined)
}

export const ifElse = (ctx) => {
  const { get } = ctx
  const pred = get(ctx.predicate.fn, ctx.predicate.fnConfig || {})
  const thenFn = get(ctx.then.fn, ctx.then.fnConfig || {})
  const elseFn = get(ctx.else.fn, ctx.else.fnConfig || {})
  return (value) => (pred(value) ? thenFn(value) : elseFn(value))
}

export const cond = (ctx) => {
  const { get } = ctx
  return (value) => {
    for (const { when: whenCase, then } of ctx.cases) {
      const pred = get(whenCase.fn, whenCase.fnConfig || {})
      if (pred(value)) {
        return get(then.fn, then.fnConfig || {})(value)
      }
    }
    return ctx.default ? get(ctx.default.fn, ctx.default.fnConfig || {})(value) : value
  }
}

// Structural handlers

export const pair =
  () =>
  (...values) =>
    values

export const zip =
  (ctx) =>
  (...values) => {
    const keys = ctx.keys || values.map((_, i) => `v${i}`)
    return Object.fromEntries(keys.map((k, i) => [k, values[i]]))
  }

export const unzip = (ctx) => (obj) => obj?.[ctx.key]

export const pick = (ctx) => (obj) => obj?.[ctx.key]

export const map = (ctx) => {
  const { get } = ctx
  const innerFn = get(ctx.fn, ctx.fnConfig || {})
  if (!innerFn) throw new Error(`map: unknown fn '${ctx.fn}'`)
  return (collection) => {
    if (!Array.isArray(collection)) return innerFn(collection)
    return collection.map((item) => innerFn(item))
  }
}

// Composition handler

export const compose = (ctx) => {
  const { get } = ctx
  const fns = ctx.steps.map((step) => {
    if (typeof step === 'string') {
      return get(step, ctx[step] || {})
    }
    return get(step.fn, step.fnConfig || {})
  })
  return (...values) => {
    let result = values.length === 1 ? values[0] : values
    for (const fn of fns) {
      result = Array.isArray(result) ? fn(...result) : fn(result)
    }
    return result
  }
}

// Utility handlers

export const identity = () => (x) => x

export const passthrough = () => (x) => x

export const constant = (ctx) => () => ctx.value

export const always = (ctx) => () => ctx.value

export const tap = (ctx) => (x) => {
  console.log(ctx.label ?? 'tap', x)
  return x
}

export const defaultTo = (ctx) => (x) => x ?? ctx.value

export const format =
  (ctx) =>
  (...values) =>
    ctx.template.replace(/\{(\d+)\}/g, (_, i) => values[i] ?? '')

export const coerce = (ctx) => (value) => {
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
}
