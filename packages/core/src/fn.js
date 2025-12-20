import { resource, routes, bind } from './resource.js'

/**
 * Built-in functions for propagators
 */
export const builtins = {
  // Arithmetic
  sum: (...args) => args.flat().reduce((a, b) => a + b, 0),
  product: (...args) => args.flat().reduce((a, b) => a * b, 1),
  subtract: (a, b) => a - b,
  divide: (a, b) => a / b,
  negate: a => -a,
  abs: a => Math.abs(a),
  mod: (a, b) => a % b,

  // Comparison
  min: (...args) => Math.min(...args.flat()),
  max: (...args) => Math.max(...args.flat()),
  gt: (a, b) => a > b,
  lt: (a, b) => a < b,
  gte: (a, b) => a >= b,
  lte: (a, b) => a <= b,
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,

  // Logic
  and: (...args) => args.flat().every(Boolean),
  or: (...args) => args.flat().some(Boolean),
  not: a => !a,

  // Arrays
  first: arr => arr?.[0],
  last: arr => arr?.[arr?.length - 1],
  length: arr => arr?.length ?? 0,
  concat: (...args) => args.flat(),
  reverse: arr => [...(arr ?? [])].reverse(),
  sort: arr => [...(arr ?? [])].sort(),
  unique: arr => [...new Set(arr ?? [])],
  flatten: arr => (arr ?? []).flat(Infinity),

  // Objects
  get: (obj, key) => obj?.[key],
  set: (obj, key, val) => ({ ...obj, [key]: val }),
  keys: obj => Object.keys(obj ?? {}),
  values: obj => Object.values(obj ?? {}),
  entries: obj => Object.entries(obj ?? {}),
  merge: (...objs) => Object.assign({}, ...objs),
  pick: (obj, ...keys) => keys.flat().reduce((acc, k) => (k in obj ? { ...acc, [k]: obj[k] } : acc), {}),
  omit: (obj, ...keys) => {
    const omitSet = new Set(keys.flat())
    return Object.fromEntries(Object.entries(obj ?? {}).filter(([k]) => !omitSet.has(k)))
  },

  // Strings
  upper: s => String(s).toUpperCase(),
  lower: s => String(s).toLowerCase(),
  trim: s => String(s).trim(),
  split: (s, sep) => String(s).split(sep),
  join: (arr, sep) => (arr ?? []).join(sep ?? ','),
  replace: (s, pattern, replacement) => String(s).replace(new RegExp(pattern, 'g'), replacement),

  // Type coercion
  number: v => Number(v),
  string: v => String(v),
  boolean: v => Boolean(v),
  json: v => JSON.stringify(v),
  parse: v => JSON.parse(v),

  // Utilities
  identity: x => x,
  constant: x => () => x,
  pair: (a, b) => [a, b],
  zip: (...arrays) => {
    const len = Math.min(...arrays.map(a => a?.length ?? 0))
    return Array.from({ length: len }, (_, i) => arrays.map(a => a[i]))
  },

  // Higher-order (return functions for composition)
  map: fn => arr => (arr ?? []).map(fn),
  filter: fn => arr => (arr ?? []).filter(fn),
  reduce: (fn, init) => arr => (arr ?? []).reduce(fn, init),
  pipe:
    (...fns) =>
    x =>
      fns.reduce((v, f) => f(v), x),
  compose:
    (...fns) =>
    x =>
      fns.reduceRight((v, f) => f(v), x),
}

/**
 * Create a fn resource (function registry / oracle)
 *
 * Routes:
 *   GET /         → bassline listing available functions
 *   GET /:name    → get function by name
 *   PUT /:name    → register custom function
 * @param customFns
 */
export const createFn = (customFns = {}) => {
  const fns = { ...builtins, ...customFns }

  return routes({
    '': resource({
      get: async () => ({
        headers: { type: '/types/bassline' },
        body: {
          name: 'fn',
          description: 'Function registry',
          resources: Object.fromEntries(Object.keys(fns).map(k => [`/${k}`, {}])),
        },
      }),
    }),

    unknown: bind(
      'name',
      resource({
        get: async h => {
          const fn = fns[h.params.name]
          if (!fn) return { headers: { condition: 'not-found' }, body: null }
          return { headers: { type: '/types/fn' }, body: fn }
        },
        put: async (h, body) => {
          if (typeof body !== 'function') {
            return { headers: { condition: 'invalid', message: 'body must be a function' }, body: null }
          }
          fns[h.params.name] = body
          return { headers: {}, body: { registered: h.params.name } }
        },
      })
    ),
  })
}

export default createFn
