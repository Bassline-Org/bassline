const BASSLINE_TYPE = Symbol('$BASSLINE_TYPE')

const JS_TYPES = {
  arr: 'js/arr',
  obj: 'js/obj',
  str: 'js/str',
  num: 'js/num',
  bigInt: 'js/bigInt',
  null: 'js/null',
  undefined: 'js/undefined',
  bool: 'js/boolean',
  fn: 'js/function',
  sym: 'js/symbol',
  error: 'js/error',
}

function detectType(value) {
  if (Array.isArray(value)) return JS_TYPES.arr
  switch (typeof value) {
    case 'number':
      return JS_TYPES.num
    case 'boolean':
      return JS_TYPES.bool
    case 'bigint':
      return JS_TYPES.bigInt
    case 'function':
      return JS_TYPES.fn
    case 'symbol':
      return JS_TYPES.sym
    case 'string':
      return JS_TYPES.str
    case 'undefined':
      return JS_TYPES.undefined
    case 'object': {
      if (value === null) return JS_TYPES.null
      if (value instanceof Error) return JS_TYPES.error
      if (value[BASSLINE_TYPE]) return value[BASSLINE_TYPE]
      return JS_TYPES.obj
    }
  }
}

function typed(type, headers, body = null) {
  return {
    headers: { ...headers, type },
    body,
  }
}

export { BASSLINE_TYPE, JS_TYPES, detectType, typed }
