import { isSym } from './reader.js'

export class EvalError extends Error {}

const isFalsy = v => v === null || v === false

export function mkVar(val, meta = {}) {
  return { _var: true, val, meta }
}
export function isVar(x) {
  return x?._var === true
}

function resolve(env, name) {
  const entry = env[name]
  if (entry === undefined) throw new EvalError(`unbound symbol: ${name}`)
  return isVar(entry) ? entry.val : entry
}

export function special(fn) {
  fn._special = true
  return fn
}

export function evaluate(expr, env) {
  if (expr === null || expr === undefined) return null
  if (typeof expr === 'number') return expr
  if (typeof expr === 'string') return expr
  if (typeof expr === 'boolean') return expr
  if (isSym(expr)) return resolve(env, expr.sym)
  if (Array.isArray(expr)) return expr.map(e => evaluate(e, env))
  if (expr.list) return evalList(expr.list, env)
  // plain object (map literal) — evaluate values
  const out = {}
  for (const [k, v] of Object.entries(expr)) out[k] = evaluate(v, env)
  return out
}

function evalList(forms, env) {
  if (forms.length === 0) return null
  const [head, ...args] = forms

  const fn = evaluate(head, env)

  // Keywords as functions: (:name alice) → get(alice, "name")
  if (typeof fn === 'string') {
    const obj = evaluate(args[0], env)
    return obj[fn]
  }

  if (typeof fn !== 'function') throw new EvalError(`not callable: ${JSON.stringify(head)}`)

  // Special forms receive unevaluated args + env + evaluate
  if (fn._special) return fn(args, env, evaluate)

  // Normal functions receive evaluated args
  const evaluatedArgs = args.map(a => evaluate(a, env))
  return fn(...evaluatedArgs)
}

function evalBody(exprs, env, eval_) {
  let result = null
  for (const expr of exprs) result = eval_(expr, env)
  return result
}

// --- Default special forms ---

export const specialForms = {
  let: special((args, env, eval_) => {
    const [bindings, ...body] = args
    if (!bindings?.list) throw new EvalError('let bindings must be a list of pairs')
    const scope = { ...env }
    for (const pair of bindings.list) {
      if (!pair?.list || pair.list.length !== 2) throw new EvalError('let binding must be a pair')
      const [name, expr] = pair.list
      if (!isSym(name)) throw new EvalError('let binding name must be a symbol')
      scope[name.sym] = mkVar(eval_(expr, scope))
    }
    return evalBody(body, scope, eval_)
  }),

  do: special((args, env, eval_) => evalBody(args, env, eval_)),

  fn: special((args, env, eval_) => {
    const [params, ...body] = args
    if (!params?.list) throw new EvalError('fn params must be a list')
    const paramNames = params.list.map(p => {
      if (!isSym(p)) throw new EvalError('fn param must be a symbol')
      return p.sym
    })
    return function (...callArgs) {
      const scope = { ...env }
      for (let i = 0; i < paramNames.length; i++) scope[paramNames[i]] = mkVar(callArgs[i])
      return evalBody(body, scope, eval_)
    }
  }),

  if: special((args, env, eval_) => {
    const [cond, then, else_] = args
    return isFalsy(eval_(cond, env)) ? (else_ !== undefined ? eval_(else_, env) : null) : eval_(then, env)
  }),

  def: special((args, env, eval_) => {
    const [name, expr] = args
    if (!isSym(name)) throw new EvalError('def name must be a symbol')
    const val = eval_(expr, env)
    // Upsert: mutate existing var or create new one
    if (isVar(env[name.sym])) {
      env[name.sym].val = val
    } else {
      env[name.sym] = mkVar(val)
    }
    return val
  }),

  defn: special((args, env, eval_) => {
    const [name, ...rest] = args
    if (!isSym(name)) throw new EvalError('defn name must be a symbol')
    const fn = specialForms.fn(rest, env, eval_)
    if (isVar(env[name.sym])) {
      env[name.sym].val = fn
    } else {
      env[name.sym] = mkVar(fn)
    }
    return fn
  }),

  quote: special(args => args[0]),

  var: special((args, env) => {
    const [name] = args
    if (!isSym(name)) throw new EvalError('var requires a symbol')
    const entry = env[name.sym]
    if (entry === undefined) throw new EvalError(`unbound symbol: ${name.sym}`)
    return isVar(entry) ? entry : mkVar(entry)
  }),

  and: special((args, env, eval_) => {
    let result = true
    for (const arg of args) {
      result = eval_(arg, env)
      if (isFalsy(result)) return result
    }
    return result
  }),

  or: special((args, env, eval_) => {
    let result = null
    for (const arg of args) {
      result = eval_(arg, env)
      if (!isFalsy(result)) return result
    }
    return result
  }),

  cond: special((args, env, eval_) => {
    for (let i = 0; i < args.length - 1; i += 2) {
      if (!isFalsy(eval_(args[i], env))) return eval_(args[i + 1], env)
    }
    if (args.length % 2 === 1) return eval_(args[args.length - 1], env)
    return null
  }),
}
