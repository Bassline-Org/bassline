const notFound = async () => ({ headers: { condition: 'not-found' }, body: null })

const safe = (handler) => async (h, b) => {
  try {
    return await handler(h, b)
  } catch (e) {
    h?.kit?.put?.({ path: '/condition' }, {
      error: e.message,
      stack: e.stack,
      context: { path: h?.path, params: h?.params }
    }).catch(() => {})
    return { headers: { condition: 'error', message: e.message }, body: null }
  }
}

const resource = ({ get = notFound, put = notFound } = {}) => ({
  get: safe(get),
  put: safe(put)
})

const splitPath = path => {
  const [segment, ...rest] = (path ?? '/').split('/').filter(Boolean)
  return [segment, rest.length ? '/' + rest.join('/') : '/']
}

function routes(map) {
  const dispatch = async (method, headers, body) => {
    const [segment, remaining] = splitPath(headers.path)
    // For root path (segment undefined), use '' key; otherwise lookup segment or fall back to unknown
    const target = segment === undefined ? map[''] : (map[segment] ?? map.unknown)
    if (!target) return notFound()
    // For unknown handler, pass full path so bind can capture the segment
    const isUnknown = map[segment] === undefined && map.unknown !== undefined
    const passPath = isUnknown ? headers.path : remaining
    return target[method]?.({ ...headers, path: passPath, segment }, body) ?? notFound()
  }

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

export { resource, routes, bind, splitPath, notFound }
