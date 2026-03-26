import { subst, lift, port, net, consume, isPlainObject } from '@bassline/core'
import { specialForms, mkVar, isVar } from './evaluator.js'

const nary =
  fn =>
  (...[head, ...tail]) =>
    tail.reduce(fn, head)

function wrapEnv(raw) {
  const env = {}
  for (const [k, v] of Object.entries(raw)) env[k] = mkVar(v)
  return env
}

export const defaultEnv = wrapEnv({
  ...specialForms,

  // Arithmetic
  '+': nary((a, b) => a + b),
  '-': nary((a, b) => a - b),
  '*': nary((a, b) => a * b),
  '/': nary((a, b) => a / b),

  // Comparison
  '=': (a, b) => a === b,
  '<': nary((a, b) => a < b),
  '>': nary((a, b) => a > b),
  '<=': nary((a, b) => a <= b),
  '>=': nary((a, b) => a >= b),
  not: a => (a === null || a === false ? true : false),

  // Predicates
  'number?': x => typeof x === 'number',
  'string?': x => typeof x === 'string',
  'nil?': x => x === null,
  'map?': x => isPlainObject(x),
  'list?': x => Array.isArray(x),
  'fn?': x => typeof x === 'function',
  'boolean?': x => typeof x === 'boolean',
  'var?': x => isVar(x),

  // Maps
  get: (obj, key) => obj[key],
  assoc: (obj, k, v) => ({ ...obj, [k]: v }),
  dissoc: (obj, k) => {
    const { [k]: _, ...rest } = obj
    return rest
  },
  keys: obj => Object.keys(obj),
  vals: obj => Object.values(obj),
  merge: (...objs) => Object.assign({}, ...objs),
  count: x => (Array.isArray(x) ? x.length : Object.keys(x).length),
  'empty?': x => (Array.isArray(x) ? x.length : Object.keys(x).length) === 0,

  // Vectors
  list: (...args) => args,
  map: (f, xs) => xs.map(f),
  filter: (f, xs) => xs.filter(f),
  reduce: (f, init, xs) => xs.reduce(f, init),
  first: xs => xs[0] ?? null,
  rest: xs => xs.slice(1),
  nth: (xs, n) => xs[n] ?? null,
  concat: (...arrs) => arrs.flat(),
  push: (xs, ...items) => [...xs, ...items],

  // Strings
  str: (...args) => args.join(''),

  // Message operations
  subst,
  lift,

  // Communication
  port,
  net,
  send: (p, msg) => p.send(msg),
  close: p => p.close(),
  consume: (p, f) => consume(p.recv, f),

  // Refs
  ref: val => ({ _ref: true, val }),
  deref: r => r.val,
  'swap!': (r, f) => {
    r.val = f(r.val)
    return r.val
  },
  'ref?': x => x?._ref === true,

  // Var metadata
  meta: v => (isVar(v) ? v.meta : {}),
  'with-meta': (v, m) => {
    if (isVar(v)) v.meta = m
    return v
  },

  // Debug
  log: console.log,
})
