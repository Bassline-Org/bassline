import { isPlainObject, isFunction } from './utils.js'

export const message = content => {
  if (content === undefined) return {}
  if (isPlainObject(content)) return { ...content }
  return { body: content }
}

export const update = (...args) => {
  if (args.length === 1) {
    const [updatefn] = args;
    if(!isFunction(updatefn)) throw new Error(`invalid update fn`)
    const fn = args[0]
    return msg => ({ ...msg, ...fn(msg) })
  }
  if(args.length === 2) {
    const [msg, fn] = args
    if(!isFunction(fn)) throw new Error('invalid update fn')
    return { ...msg, ...fn(msg) }
  }
  throw new Error(`invalid update arity: ${args.length}`)
}

export const isEmpty = msg => Object.keys(msg).length === 0

export default message

export const warning = reason => message({type: 'warning', body: reason})

export const fault = (condition, msg, context = {}) => message({fault: condition, on: msg, ...context})
export const throwFault = (condition, msg, context = {}) => {throw fault(condition, msg, context)};
