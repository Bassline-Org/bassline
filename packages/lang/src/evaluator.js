import { isSym } from './reader.js'

export class EvalError extends Error {}

export function evaluate(expr, env) {
  if (expr === null || expr === undefined) return null
  if (typeof expr === 'number') return expr
  if (typeof expr === 'string') return expr
  if (typeof expr === 'boolean') return expr
  if (isSym(expr)) {
    if (!(expr.sym in env)) throw new EvalError(`unbound symbol: ${expr.sym}`)
    return env[expr.sym]
  }
  if (Array.isArray(expr)) return expr.map(e => evaluate(e, env))
  if (expr.list) return evalList(expr.list, env)
  const out = {}
  for (const [k, v] of Object.entries(expr)) out[k] = evaluate(v, env)
  return out
}

function evalList(forms, env) {
  if (forms.length === 0) return null
  const [head, ...args] = forms

  // Special forms
  if (isSym(head)) {
    switch (head.sym) {
      case 'let':
        return evalLet(args, env)
      case 'do':
        return evalDo(args, env)
      case 'fn':
        return evalFn(args, env)
      case 'if':
        return evalIf(args, env)
      case 'def':
        return evalDef(args, env)
      case 'quote':
        return args[0]
    }
  }

  const fn = evaluate(head, env)
  if (typeof fn !== 'function') throw new EvalError(`not callable: ${JSON.stringify(head)}`)
  const evaluatedArgs = args.map(a => evaluate(a, env))
  return fn(...evaluatedArgs)
}

function evalLet(args, env) {
  const [bindings, ...body] = args
  if (!bindings?.list) throw new EvalError('let bindings must be a list of pairs')
  const scope = { ...env }
  for (const pair of bindings.list) {
    if (!pair?.list || pair.list.length !== 2) throw new Error('let binding must be a pair')
    const [name, expr] = pair.list
    if (!isSym(name)) throw new EvalError('let binding name must be a symbol')
    scope[name.sym] = evaluate(expr, scope)
  }
  return evalBody(body, scope)
}

function evalDo(args, env) {
  return evalBody(args, env)
}

function evalFn(args, env) {
  const [params, ...body] = args
  if (!params?.list) throw new EvalError('fn params must be a list')
  const paramNames = params.list.map(p => {
    if (!isSym(p)) throw new EvalError('fn param must be a symbol')
    return p.sym
  })
  return function (...callArgs) {
    const scope = { ...env }
    for (let i = 0; i < paramNames.length; i++) scope[paramNames[i]] = callArgs[i]
    return evalBody(body, scope)
  }
}

function evalIf(args, env) {
  const [cond, then, else_] = args
  const val = evaluate(cond, env)
  if (val !== null && val !== false) return evaluate(then, env)
  return else_ !== undefined ? evaluate(else_, env) : null
}

function evalDef(args, env) {
  const [name, expr] = args
  if (!isSym(name)) throw new EvalError('def name must be a symbol')
  const val = evaluate(expr, env)
  env[name.sym] = val
  return val
}

function evalBody(exprs, env) {
  let result = null
  for (const expr of exprs) result = evaluate(expr, env)
  return result
}
