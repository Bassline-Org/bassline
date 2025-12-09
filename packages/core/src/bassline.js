/**
 * @typedef {Object} Response
 * @property {Object} headers - Response headers (type, capabilities, etc.)
 * @property {*} body - Response body (scalar or compound with links)
 */

/**
 * @typedef {Object.<string, string>} Params
 * Extracted path parameters (e.g., { name: 'counter' } for /cells/:name)
 */

/**
 * @typedef {Object.<string, *>} Headers
 * Request headers for context, capabilities, etc.
 */

/**
 * @typedef {Object} Context
 * @property {Params} params - Extracted path parameters
 * @property {Headers} headers - Request headers
 * @property {URLSearchParams} query - Query parameters from the URI
 * @property {*} [body] - Request body (only present for PUT)
 * @property {Bassline} bl - Bassline instance for nested resolution
 */

/**
 * @callback Handler
 * @param {Context} ctx - Request context
 * @returns {Response|null|Promise<Response|null>} Response, null, or Promise
 */

/**
 * @typedef {Object} RouteConfig
 * @property {Handler} [get] - Handler for GET requests
 * @property {Handler} [put] - Handler for PUT requests
 */

/**
 * Bassline - Minimal routing with pattern matching
 *
 * @example
 * const bl = new Bassline()
 *
 * bl.route('/cells/:name', {
 *   get: ({ params, query, bl }) => ({
 *     headers: { type: 'cell' },
 *     body: { value: `bl:///cells/${params.name}/value` }
 *   })
 * })
 *
 * bl.get('bl:///cells/counter')
 * // → { headers: { type: 'cell' }, body: { value: 'bl:///cells/counter/value' } }
 */
export class Bassline {
  constructor() {
    /** @type {Array<{pattern: string, regex: RegExp, paramNames: string[], config: RouteConfig}>} */
    this.routes = []
  }

  /**
   * Register a route with pattern matching
   *
   * Supports:
   * - `:param` - matches a single path segment
   * - `:param*` - matches remaining path segments (wildcard, must be last)
   *
   * @param {string} pattern - URL pattern with :param placeholders (e.g., '/cells/:name', '/data/:path*')
   * @param {RouteConfig} config - Route configuration with get/put handlers
   * @returns {this} For chaining
   *
   * @example
   * bl.route('/users/:id', {
   *   get: ({ params }) => ({ headers: {}, body: { id: params.id } }),
   *   put: ({ params, body }) => { ... }
   * })
   *
   * // Wildcard - matches /files/any/nested/path
   * bl.route('/files/:path*', {
   *   get: ({ params }) => ({ headers: {}, body: { path: params.path } })
   * })
   */
  route(pattern, config) {
    const paramNames = []
    let regexStr = pattern

    // Handle wildcard params (:param*) - must match rest of path
    regexStr = regexStr.replace(/:(\w+)\*/g, (_, name) => {
      paramNames.push(name)
      return '(.+)'
    })

    // Handle regular params (:param) - single segment
    regexStr = regexStr.replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name)
      return '([^/]+)'
    })

    const regex = new RegExp(`^${regexStr}$`)
    this.routes.push({ pattern, regex, paramNames, config })
    this._sortRoutes()
    return this
  }

  /** @private */
  _sortRoutes() {
    // More specific routes first (more segments, more literals, wildcards last)
    this.routes.sort((a, b) => {
      // Wildcards are least specific
      const wcA = a.pattern.includes('*') ? 1 : 0
      const wcB = b.pattern.includes('*') ? 1 : 0
      if (wcA !== wcB) return wcA - wcB

      const segsA = a.pattern.split('/').filter(Boolean).length
      const segsB = b.pattern.split('/').filter(Boolean).length
      if (segsA !== segsB) return segsB - segsA

      const litsA = a.pattern.split('/').filter(s => s && !s.startsWith(':')).length
      const litsB = b.pattern.split('/').filter(s => s && !s.startsWith(':')).length
      return litsB - litsA
    })
  }

  /** @private */
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

  /**
   * GET a resource by URI
   *
   * @param {string} uri - Full URI (e.g., 'bl:///cells/counter')
   * @param {Headers} [headers={}] - Request headers
   * @returns {Promise<Response|null>} Response or null if no matching route
   *
   * @example
   * const response = await bl.get('bl:///cells/counter', { auth: 'token' })
   * console.log(response.headers.type)  // 'cell'
   * console.log(response.body.value)    // 'bl:///cells/counter/value'
   */
  async get(uri, headers = {}) {
    const url = new URL(uri)
    const matched = this._match(url.pathname)
    if (!matched?.route.config.get) return null

    const ctx = {
      params: matched.params,
      headers,
      query: url.searchParams,
      bl: this
    }
    return matched.route.config.get(ctx)
  }

  /**
   * PUT to a resource by URI
   *
   * @param {string} uri - Full URI (e.g., 'bl:///cells/counter/write')
   * @param {Headers} [headers={}] - Request headers
   * @param {*} body - Request body
   * @returns {Promise<Response|null>} Response or null if no matching route
   *
   * @example
   * const response = await bl.put('bl:///cells/counter/write', {}, 42)
   */
  async put(uri, headers = {}, body) {
    const url = new URL(uri)
    const matched = this._match(url.pathname)
    if (!matched?.route.config.put) return null

    const ctx = {
      params: matched.params,
      headers,
      query: url.searchParams,
      body,
      bl: this
    }
    return matched.route.config.put(ctx)
  }

  /**
   * Install routes from a RouterBuilder
   *
   * @param {import('./router.js').RouterBuilder} routerBuilder - Router builder with route definitions
   * @returns {this} For chaining
   *
   * @example
   * import { routes } from './router.js'
   *
   * const cellRoutes = routes('/cells/:name', r => {
   *   r.get('/', (params) => ({ headers: {}, body: 'cell' }))
   * })
   *
   * bl.install(cellRoutes)
   */
  install(routerBuilder) {
    routerBuilder.install(this)
    return this
  }
}
