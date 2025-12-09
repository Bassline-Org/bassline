// Bassline - minimal routing with pattern matching

export class Bassline {
  constructor() {
    this.routes = []
  }

  route(pattern, config) {
    const paramNames = []
    const regexStr = pattern.replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name)
      return '([^/]+)'
    })
    const regex = new RegExp(`^${regexStr}$`)
    this.routes.push({ pattern, regex, paramNames, config })
    this._sortRoutes()
    return this
  }

  _sortRoutes() {
    // More specific routes first (more segments, more literals)
    this.routes.sort((a, b) => {
      const segsA = a.pattern.split('/').filter(Boolean).length
      const segsB = b.pattern.split('/').filter(Boolean).length
      if (segsA !== segsB) return segsB - segsA
      const litsA = a.pattern.split('/').filter(s => s && !s.startsWith(':')).length
      const litsB = b.pattern.split('/').filter(s => s && !s.startsWith(':')).length
      return litsB - litsA
    })
  }

  _match(path) {
    for (const route of this.routes) {
      const match = path.match(route.regex)
      if (match) {
        const params = {}
        route.paramNames.forEach((name, i) => params[name] = match[i + 1])
        return { route, params }
      }
    }
    return null
  }

  get(uri, headers = {}) {
    const path = new URL(uri).pathname
    const matched = this._match(path)
    if (!matched?.route.config.get) return null
    return matched.route.config.get(matched.params, headers, this)
  }

  put(uri, headers = {}, body) {
    const path = new URL(uri).pathname
    const matched = this._match(path)
    if (!matched?.route.config.put) return null
    return matched.route.config.put(matched.params, headers, body, this)
  }

  install(routerBuilder) {
    routerBuilder.install(this)
    return this
  }
}
