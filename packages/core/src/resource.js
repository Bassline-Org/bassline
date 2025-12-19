const notFound = async () => ({ headers: { status: 404 }, body: null })

const resource = ({ get = notFound, put = notFound } = {}) => ({ get, put })

const splitPath = path => {
  const [segment, ...rest] = (path ?? '/').split('/').filter(Boolean)
  return [segment, rest.length ? '/' + rest.join('/') : '/']
}

function routes(map) {
  const dispatch = async (method, headers, body) => {
    const [segment, remaining] = splitPath(headers.path)
    const target = map[segment] ?? map.unknown
    if (!target) return notFound()
    return target[method]?.({ ...headers, path: remaining, segment }, body) ?? notFound()
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
