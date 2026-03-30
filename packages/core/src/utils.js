export const isArray = v => Array.isArray(v)
export const isNil = obj => obj == null
export const isPromise = obj => obj instanceof Promise
export const isNumber = v => typeof v === 'number'
export const isString = v => typeof v === 'string'
export const isFunction = v => typeof v === 'function'
export const isSymbol = v => typeof v === 'symbol'
export const isNull = v => v === null
export const isPlainObject = obj => {
  if (obj == null) return false
  return Object.getPrototypeOf(obj) === Object.prototype
}
export const hasKeys = (obj, keys = []) => {
  if (isNil(obj)) return false
  const requiredKeys = isArray(keys) ? keys : [keys],
    objectKeys = new Set(Object.keys(obj))

  return requiredKeys.every(key => objectKeys.has(key))
}
export const not = predicate => value => !predicate(value)
export const constant = value => () => value
export const identity = value => value
export const delay = async (ms = 1000) => {
  await new Promise(res => setTimeout(res, ms))
  return
}

export const castArr = value => (isArray(value) ? value : [value])

export const keys = o => (isNil(o) ? [] : Object.keys(o))
export const values = o => (isNil(o) ? [] : Object.values(o))
export const syms = o => (isNil(o) ? [] : Object.getOwnSymbolNames(o))
export const index = (keys, table) => keys.map(k => table[k])
export const path = (keys, table) => {
  let ctx = table
  for (const key of keys) {
    if (isNil(ctx)) break
    ctx = table[key]
  }
  return ctx
}
