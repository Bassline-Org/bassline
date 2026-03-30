import { isPlainObject, isSymbol, isFunction } from './utils.js'
import { propagator } from './comms.js'

export const isEmpty = msg => Object.keys(msg).length === 0
export function message(content) {
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

export const hasCap = (msg, name) => msg[name] && isFunction(msg[name])

function assertHandlers(handlers) {
  const syms = Object.getOwnPropertySymbols(handlers)
  for (const sym of syms) {
    if (!isSymbol(sym)) throw new Error('invalid handler key, must be a symbol!')
    if (!isFunction(handlers[sym])) throw new Error('invalid handler,  must be a function')
  }
  return syms
}

export function offer(handlers) {
  const syms = assertHandlers(handlers)
  return propagator((msg, propagate) => {
    const enriched = { ...msg }
    for (const sym of syms) {
      enriched[sym] = m => void handlers[sym](m)
    }
    propagate(enriched)
  })
}

export function accept(handlers) {
  const syms = assertHandlers(handlers)
  return propagator(async (msg, propagate) => {
    for (const sym of syms) {
      if (hasCap(msg, sym)) await handlers[sym](msg, msg[sym])
    }
    propagate(msg)
  })
}
