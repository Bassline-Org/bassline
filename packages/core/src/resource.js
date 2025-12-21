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
const typed = (type, headers, body = null) => ({
  headers: { ...headers, type },
  body,
})

const notFound = async () => typed(JS_TYPES.error, { condition: 'not-found' }, null)

const safe = handler => async (h, b) => {
  try {
    return await handler(h, b)
  } catch (e) {
    h?.kit
      ?.put?.(
        { type: JS_TYPES.error, path: '/condition' },
        {
          error: e.message,
          stack: e.stack,
          context: { path: h?.path, params: h?.params },
        }
      )
      .catch(() => {})
    return { headers: { type: JS_TYPES.error, condition: 'error' }, body: { error: e.message } }
  }
}

const detectType = value => {
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

const resource = ({ get = notFound, put = notFound } = {}) => ({
  get: safe(get),
  put: safe(async (headers, body) => {
    if (!headers?.type) {
      headers.type = detectType(body)
    }
    return await put(headers, body)
  }),
})

const splitPath = path => {
  const [segment, ...rest] = (path ?? '/').split('/').filter(Boolean)
  return [segment, rest.length ? '/' + rest.join('/') : '/']
}

const pathRoot = headers => {
  const [segment, remaining] = splitPath(headers.path)
  return [segment, { ...headers, path: remaining }]
}

const byKey = key => headers => {
  return [headers[key], headers]
}

const disp = (map, dispatchFn) => async (method, headers, body) => {
  const [key, rest] = await dispatchFn(headers)
  const target = map[key ?? ''] ?? map.unknown
  if (!target) return notFound()
  // For unknown handler, pass original headers
  const isUnknown = map[key] === undefined && map.unknown !== undefined
  if (isUnknown) {
    return target[method]?.(headers, body) ?? notFound()
  }
  return target[method]?.(rest, body) ?? notFound()
}

function routes(map, dispatchFn = pathRoot) {
  const dispatch = disp(map, dispatchFn)
  return resource({
    get: h => dispatch('get', h),
    put: (h, b) => dispatch('put', h, b),
  })
}

const bind = (name, target) => {
  const next = h => {
    const [segment, remaining] = splitPath(h.path)
    return { ...h, path: remaining, params: { ...h.params, [name]: segment } }
  }
  return resource({
    get: h => target.get(next(h)),
    put: (h, b) => target.put(next(h), b),
  })
}

export { resource, routes, bind, splitPath, notFound, pathRoot, byKey, detectType, BASSLINE_TYPE }
