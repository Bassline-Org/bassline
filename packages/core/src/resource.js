const notFound = async () => ({ headers: { condition: 'not-found' }, body: null })

const safe = handler => async (h, b) => {
  try {
    return await handler(h, b)
  } catch (e) {
    h?.kit
      ?.put?.(
        { path: '/condition' },
        {
          error: e.message,
          stack: e.stack,
          context: { path: h?.path, params: h?.params },
        }
      )
      .catch(() => {})
    return { headers: { condition: 'error', message: e.message }, body: null }
  }
}

const resource = ({ get = notFound, put = notFound } = {}) => ({
  get: safe(get),
  put: safe(put),
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

export { resource, routes, bind, splitPath, notFound, pathRoot, byKey }
