/**
 * Control Handlers
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
  const predHandler = get(ctx.handler, ctx.config || {})
  if (!predHandler) throw new Error(`filter: unknown handler '${ctx.handler}'`)
  return (value) => (predHandler(value) ? value : undefined)
}

// when: Alias for filter (kept for compatibility)
export const when = (ctx) => {
  const { get } = ctx
  const predHandler = get(ctx.handler, ctx.config || {})
  if (!predHandler) throw new Error(`when: unknown handler '${ctx.handler}'`)
  return (value) => (predHandler(value) ? value : undefined)
}

export const ifElse = (ctx) => {
  const { get } = ctx
  const pred = get(ctx.predicate.handler, ctx.predicate.config || {})
  const thenH = get(ctx.then.handler, ctx.then.config || {})
  const elseH = get(ctx.else.handler, ctx.else.config || {})
  return (value) => (pred(value) ? thenH(value) : elseH(value))
}

export const cond = (ctx) => {
  const { get } = ctx
  return (value) => {
    for (const { when: whenCase, then } of ctx.cases) {
      const pred = get(whenCase.handler, whenCase.config || {})
      if (pred(value)) {
        return get(then.handler, then.config || {})(value)
      }
    }
    return ctx.default ? get(ctx.default.handler, ctx.default.config || {})(value) : value
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
  const innerHandler = get(ctx.handler, ctx.config || {})
  if (!innerHandler) throw new Error(`map: unknown handler '${ctx.handler}'`)
  return (collection) => {
    if (!Array.isArray(collection)) return innerHandler(collection)
    return collection.map((item) => innerHandler(item))
  }
}

// Composition handler

export const compose = (ctx) => {
  const { get } = ctx
  const handlers = ctx.steps.map((step) => {
    if (typeof step === 'string') {
      return get(step, ctx[step] || {})
    }
    return get(step.handler, step.config || {})
  })
  return (...values) => {
    let result = values.length === 1 ? values[0] : values
    for (const h of handlers) {
      result = Array.isArray(result) ? h(...result) : h(result)
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
