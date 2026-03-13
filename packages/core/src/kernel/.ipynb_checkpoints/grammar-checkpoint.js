import { isPlainObject, isArray, hasKeys, isNumber, isString, isFunction } from "./utils.js"
export { isPlainObject, isArray, hasKeys, isNumber, isString, isFunction };

const normalizeSelector = selector => {
  if (isString(selector)) return selector.split(':').filter(Boolean);
  if (isArray(selector)) return selector;
  if (isPlainObject(selector)) return Object.keys(selector)
  throw new Error('Invalid selector')
}

export const message = ({ selector = [], guard = () => true }) => {
  let normalized = normalizeSelector(selector)
  const match = (msg = {}) => hasKeys(msg, normalized) && guard(msg)
  return {
    selector: normalized,
    match,
    type: normalized.includes('put') ? 'put' : 'get',
  }
}

/**
 * Thrown when a grammar cannot recognize a message.
 */
export class DoesNotUnderstandError extends Error {
  constructor(msg) {
    super(`does not understand: ${JSON.stringify(msg)}`)
    this.msg = msg
  }
}