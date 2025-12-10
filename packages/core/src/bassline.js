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
 * @typedef {Object} TapContext
 * @property {string} uri - The URI that was accessed
 * @property {Headers} headers - Request headers
 * @property {*} [body] - Request body (only present for PUT taps)
 * @property {Response|null} result - Response from the handler
 * @property {Bassline} bl - Bassline instance
 */

/**
 * @callback Tap
 * @param {TapContext} ctx - Tap context
 * @returns {void}
 */

/**
 * @typedef {Object} MiddlewareContext
 * @property {string} verb - The HTTP verb ('get' or 'put')
 * @property {string} uri - The full URI being accessed
 * @property {Params} params - Extracted path parameters
 * @property {Headers} headers - Request headers
 * @property {URLSearchParams} query - Query parameters from the URI
 * @property {*} [body] - Request body (only present for PUT)
 * @property {Bassline} bl - Bassline instance
 */

/**
 * @callback Middleware
 * @param {MiddlewareContext} ctx - Middleware context
 * @param {function(): Promise<Response|null>} next - Call to continue to next middleware/handler
 * @returns {Response|null|Promise<Response|null>} Response, null, or Promise
 */

/**
 * @typedef {Object} MiddlewareEntry
 * @property {Middleware} fn - The middleware function
 * @property {number} priority - Sort priority (lower runs first)
 * @property {string} [id] - Optional identifier for removal
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
 *
 * // Taps observe operations without intercepting
 * bl.tap('put', ({ uri, body }) => {
 *   console.log(`PUT ${uri}:`, body)
 * })
 */
export class Bassline {
  constructor() {
    /** @type {Array<{pattern: string, regex: RegExp, paramNames: string[], config: RouteConfig}>} */
    this.routes = []
    /** @type {{ get: Tap[], put: Tap[] }} */
    this.taps = { get: [], put: [] }
    /** @type {MiddlewareEntry[]} */
    this.middleware = []
  }

  /**
   * Register middleware to intercept requests
   * Middleware runs before route handlers in priority order (lower first)
   * Returns an uninstaller function for clean removal
   *
   * @param {Middleware} fn - Middleware function (ctx, next) => result
   * @param {Object} [options] - Options
   * @param {number} [options.priority=50] - Sort priority (lower runs first)
   * @param {string} [options.id] - Optional identifier for introspection/removal
   * @returns {function(): void} Uninstaller function
   *
   * @example
   * // Logging middleware
   * const uninstall = bl.use(async (ctx, next) => {
   *   console.log(`${ctx.verb} ${ctx.uri}`)
   *   return next()
   * }, { priority: 10, id: 'logger' })
   *
   * // Later: uninstall()
   *
   * @example
   * // Auth middleware - reject if no peer
   * bl.use(async (ctx, next) => {
   *   if (!ctx.headers.peer) {
   *     return { headers: { error: 'unauthorized' }, body: null }
   *   }
   *   return next()
   * }, { priority: 20, id: 'auth' })
   */
  use(fn, { priority = 50, id } = {}) {
    const entry = { fn, priority, id }
    this.middleware.push(entry)
    this.middleware.sort((a, b) => a.priority - b.priority)
    return () => {
      this.middleware = this.middleware.filter(m => m !== entry)
    }
  }

  /**
   * Register a tap to observe operations
   * Taps are called after handlers complete - they observe but don't intercept
   *
   * @param {'get'|'put'} verb - Which operation to observe
   * @param {Tap} fn - Tap function
   * @returns {this} For chaining
   *
   * @example
   * // Log all writes
   * bl.tap('put', ({ uri, body }) => {
   *   console.log(`Written to ${uri}:`, body)
   * })
   *
   * // Index links on write
   * bl.tap('put', ({ uri, body }) => {
   *   linkIndex.index(uri, body)
   * })
   */
  tap(verb, fn) {
    if (this.taps[verb]) {
      this.taps[verb].push(fn)
    }
    return this
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
    // Check if route with this pattern already exists - merge handlers if so
    const existing = this.routes.find(r => r.pattern === pattern)
    if (existing) {
      if (config.get) existing.config.get = config.get
      if (config.put) existing.config.put = config.put
      return this
    }

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
      // Skip routes without patterns (sort them last)
      if (!a.pattern) return 1
      if (!b.pattern) return -1

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
   * Dispatch request through middleware chain then to route handler
   * @private
   * @param {MiddlewareContext} ctx - Request context
   * @param {function(): Promise<Response|null>} handleRoute - Final route handler
   * @returns {Promise<Response|null>}
   */
  async _dispatch(ctx, handleRoute) {
    let index = 0
    const next = async () => {
      if (index < this.middleware.length) {
        return this.middleware[index++].fn(ctx, next)
      }
      return handleRoute()
    }
    return next()
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
      verb: 'get',
      uri,
      params: matched.params,
      headers,
      query: url.searchParams,
      bl: this
    }

    const handleRoute = () => matched.route.config.get(ctx)
    const result = await this._dispatch(ctx, handleRoute)

    // Call taps after handler (ambient observation)
    for (const tap of this.taps.get) {
      tap({ uri, headers, result, bl: this })
    }

    return result
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
      verb: 'put',
      uri,
      params: matched.params,
      headers,
      query: url.searchParams,
      body,
      bl: this
    }

    const handleRoute = () => matched.route.config.put(ctx)
    const result = await this._dispatch(ctx, handleRoute)

    // Call taps after handler (ambient observation)
    for (const tap of this.taps.put) {
      tap({ uri, headers, body, result, bl: this })
    }

    return result
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
