import { isSym } from './reader.js'

export class EvalError extends Error {}

const isFalsy = v => v === null || v === false

export function createEnv(parent = null) {
  return Object.create(parent)
}

export function mkVar(val, meta = {}) {
  return { _var: true, val, meta }
}

export function isVar(x) {
  return x?._var === true
}

function resolve(env, name) {
  const entry = env[name]
  if (entry === undefined) throw new EvalError(`unbound symbol: ${name}`)
  return entry.val
}

export function special(fn) {
  fn._special = true
  return fn
}

export function evaluate(expr, env) {
  if (expr == null) return null
  switch (expr.tt) {
    case 'number':
    case 'string':
    case 'keyword':
      return expr.val
    case 'symbol':
      if (expr.literal) return expr.val
      return resolve(env, expr.val)
    case 'map': {
      const out = {}
      for (let i = 0; i < expr.val.length; i += 2) {
        const key = evaluate(expr.val[i], env)
        const val = evaluate(expr.val[i + 1], env)
        if (typeof key !== 'string') throw new EvalError(`map keys must be keywords or strings got: ${typeof key}`)
        out[key] = val
      }
      return out
    }
    case 'vector':
      return expr.val.map(e => evaluate(e, env))
    case 'list':
      return evalList(expr.val, env)
    default:
      throw new EvalError(`unknown form: ${JSON.stringify(expr)}`)
  }
}

function evalList(forms, env) {
  if (forms.length === 0) throw new EvalError('invalid application, no forms', forms)
  const [head, ...args] = forms

  const fn = evaluate(head, env)

  if (typeof fn === 'string') {
    const obj = evaluate(args[0], env)
    return obj[fn]
  }

  if (typeof fn !== 'function') throw new EvalError(`not callable: ${JSON.stringify(head)} `)

  if (fn._special) return fn(args, env, evaluate)
  const evaluatedArgs = args.map(a => evaluate(a, env))
  return fn(...evaluatedArgs)
}

function evalBody(exprs, env, ev) {
  let result = null
  for (const expr of exprs) result = ev(expr, env)
  return result
}

function upsertBinding(name, value, env) {
  if (Object.hasOwn(env, name)) {
    env[name].val = value
  } else {
    env[name] = mkVar(value)
  }
}

function bind(name, value, env) {
  switch (name.tt) {
    case 'map':
      name.val.forEach(key => {
        if (key.tt !== 'symbol') throw new EvalError('invalid map destructure')
        upsertBinding(key.val, value[key.val], env)
      })
      break
    case 'vector':
      name.val.forEach((key, i) => {
        if (key.tt !== 'symbol') throw new EvalError('invalid vector destructure')
        upsertBinding(key.val, value[i], env)
      })
      break
    case 'symbol':
      upsertBinding(name.val, value, env)
      break
    default:
      console.error('key type: ', name.tt)
      console.error('key:', name)
      console.error('value: ', value)
      throw new EvalError(`invalid binding key`)
  }
}

export const specialForms = {
  let: special((args, env, ev) => {
    const [bindings, ...body] = args
    if (bindings?.tt !== 'vector') throw new EvalError('let bindings must be a vector')
    const scope = createEnv(env)
    for (let i = 0; i < bindings.val.length; i += 2) {
      const name = bindings.val[i]
      const expr = ev(bindings.val[i + 1], scope)
      bind(name, expr, scope)
    }
    return evalBody(body, scope, ev)
  }),

  do: special((args, env, eval_) => evalBody(args, env, eval_)),

  fn: special((args, env, eval_) => {
    const [params, ...body] = args
    if (!params.tt === 'vector') throw new EvalError('fn params must be a vector')
    const paramNames = params.val.map(p => {
      if (!isSym(p)) throw new EvalError('fn param must be a symbol')
      return p.val
    })
    return function (...callArgs) {
      const scope = createEnv(env)
      paramNames.forEach((p, i) => upsertBinding(p, callArgs[i], scope))
      return evalBody(body, scope, eval_)
    }
  }),

  if: special((args, env, eval_) => {
    const [cond, then, else_] = args
    if (eval_(cond, env)) {
      return eval_(then, env)
    } else {
      return eval_(else_, env)
    }
  }),

  def: special((args, env, eval_) => {
    const [name, expr] = args
    if (!isSym(name)) throw new EvalError('def name must be a symbol')
    const val = eval_(expr, env)
    upsertBinding(name.val, val, env)
    return val
  }),

  defn: special((args, env, eval_) => {
    const [name, ...rest] = args
    if (!isSym(name)) throw new EvalError('defn name must be a symbol')
    const fn = specialForms.fn(rest, env, eval_)
    upsertBinding(name.val, fn, env)
    return fn
  }),

  quote: special(args => args[0]),

  var: special((args, env) => {
    const [name] = args
    console.log(name)
    if (!isSym(name)) throw new EvalError('var requires a symbol')
    const entry = env[name.val]
    if (entry === undefined) throw new EvalError(`unbound var: ${name.val} `)
    return entry
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
