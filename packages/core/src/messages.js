import { isPlainObject } from './utils.js'

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
