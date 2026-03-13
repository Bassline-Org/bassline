import { isPlainObject } from './utils.js'

export const message = content => {
  if (content === undefined) return {}
  if (isPlainObject(content)) return { ...content }
  return { body: content }
}

export function updateWith(msg, fn) {
  return { ...msg, ...fn(msg) }
}

export function update(...args) {
  if (args.length === 1) {
    const [fn] = args
    return msg => updateWith(msg, fn)
  }
  if (args.length === 2) {
    const [msg, fn] = args
    return updateWith(msg, fn)
  }
  throw new Error(`invalid update arity: ${args.length}`)
}

export const isEmpty = msg => Object.keys(msg).length === 0

export const warning = reason => message({ type: 'warning', body: reason })

export class Fault extends Error {
  constructor(condition, msg, context = {}) {
    super(`fault: ${condition}`)
    this.condition = condition
    this.msg = msg
    this.context = context
  }
}
export const fault = (condition, msg, context) => {
  throw new Fault(condition, msg, context)
}
