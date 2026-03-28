import { isPlainObject, isString, isSymbol, isFunction, hasKeys } from './utils.js'

export const isEmpty = msg => Object.keys(msg).length === 0
export const message = content => {
  if (content === undefined) return {}
  if (isPlainObject(content)) return { ...content }
  return { body: content }
}

export function update(...args) {
  switch (args.length) {
    case 1: {
      const [fn] = args
      return msg => message(fn(msg))
    }
    case 2: {
      const [msg, fn] = args
      return message(fn(msg))
    }
    default:
      throw new Error(`invalid update arity: ${args.length}`)
  }
}

export class Fault extends Error {
  constructor(condition, msg, context = {}) {
    super(`fault: ${condition}`)
    this.condition = condition
    this.msg = msg
    this.context = context
  }
  toMessage() {
    return message({ condition: this.condition, msg: this.msg, ...this.context })
  }
}

export const fault = (condition, msg, context) => new Fault(condition, msg, context)

export function subst(msg) {
  switch (true) {
    case !hasKeys(msg, ['let', 'in']):
      throw fault('expand requires msg to have keys let & in')
    case !isPlainObject(msg.let):
    case !isPlainObject(msg.in):
      throw fault('msg.in & msg.let must be objects')
    default:
      return rewrite(msg.let, msg.in)
  }
}

export function lift(msg) {
  const let_ = {}
  const in_ = { ...msg }
  for (const f of Object.keys(msg)) {
    let_[f] = msg[f]
    in_[f] = f
  }
  return { let: let_, in: in_ }
}

function rewrite(bindings, value) {
  switch (true) {
    case isString(value) && value in bindings:
      return bindings[value]
    case Array.isArray(value):
      return value.map(item => rewrite(bindings, item))
    case isPlainObject(value): {
      const out = {}
      for (const [k, v] of Object.entries(value)) out[k] = rewrite(bindings, v)
      return out
    }
    default:
      return value
  }
}

export const hasCap = (msg, name) => msg[name] && isFunction(msg[name])

function assertHandlers(handlers) {
  const syms = Object.getOwnPropertySymbols(handlers)
  for (const sym of syms) {
    if (!isSymbol(sym)) throw new Error('invalid handler key, must be a symbol!')
    if (!isFunction(handlers[sym])) throw new Error('invalid handler,  must be a function')
  }
  return syms
}

export function offer(dest, handlers) {
  const syms = assertHandlers(handlers)
  return msg => {
    const enriched = { ...msg }
    for (const sym of syms) {
      enriched[sym] = m => void handlers[sym](m)
    }
    dest(enriched)
  }
}

export function accept(handlers) {
  const syms = assertHandlers(handlers)
  if (syms.length === 0) throw new Error('[accept] invalid handlers object, no symbols')
  return async msg => {
    for (const sym of syms) {
      if (hasCap(msg, sym)) await handlers[sym](msg[sym], msg)
    }
  }
}
