/**
 * @typedef {object} Response
 * @property {object} headers - Response headers (type, capabilities, etc.)
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
 * @typedef {object} Context
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
 * @typedef {object} RouteConfig
 * @property {Handler} [get] - Handler for GET requests
 * @property {Handler} [put] - Handler for PUT requests
 */

/**
 * @typedef {object} TapContext
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
 * @typedef {object} MiddlewareContext
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
 * @typedef {object} MiddlewareEntry
 * @property {Middleware} fn - The middleware function
 * @property {number} priority - Sort priority (lower runs first)
 * @property {string} [id] - Optional identifier for removal
 */

/**
 * Bassline - Minimal routing with pattern matching
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
    /** @type {Map<string, any>} */
    this._modules = new Map()
    /** @type {Map<string, Array<Function>>} */
    this._modulePending = new Map()
  }

  /**
   * Register a module for late binding
   * Resolves any pending getModule() calls for this name
   * Sends module-registered event through plumber
   * @param {string} name - Module name (e.g., 'cells', 'plumber', 'handlers')
   * @param {any} module - Module instance
   * @returns {this} For chaining
   * @example
   * bl.setModule('cells', cellsModule)
   * bl.setModule('handlers', handlerRegistry)
   */
  setModule(name, module) {
    const isNew = !this._modules.has(name)
    this._modules.set(name, module)

    // Resolve any pending requests
    const pending = this._modulePending.get(name)
    if (pending) {
      for (const resolve of pending) {
        resolve(module)
      }
      this._modulePending.delete(name)
    }

    // Notify through plumber
    const source = `bl:///modules/${name}`
    if (isNew) {
      this.plumb(source, 'module-registered', {
        headers: { type: 'bl:///types/module-registered' },
        body: { name, source },
      })
    } else {
      this.plumb(source, 'module-updated', {
        headers: { type: 'bl:///types/module-updated' },
        body: { name, source },
      })
    }

    return this
  }

  /**
   * Get a module by name, waiting if not yet available
   * @param {string} name - Module name
   * @returns {Promise<any>} Promise that resolves to the module
   * @example
   * const cells = await bl.getModule('cells')
   * const handlers = await bl.getModule('handlers')
   * const sum = handlers.get('sum', {})
   */
  getModule(name) {
    const module = this._modules.get(name)
    if (module !== undefined) {
      return Promise.resolve(module)
    }
    // Wait for setModule to be called
    return new Promise((resolve) => {
      if (!this._modulePending.has(name)) {
        this._modulePending.set(name, [])
      }
      this._modulePending.get(name).push(resolve)
    })
  }

  /**
   * Check if a module is available (non-blocking)
   * @param {string} name - Module name
   * @returns {boolean} True if module is registered
   */
  hasModule(name) {
    return this._modules.has(name)
  }

  /**
   * Register middleware to intercept requests
   * Middleware runs before route handlers in priority order (lower first)
   * Returns an uninstaller function for clean removal
   * @param {Middleware} fn - Middleware function (ctx, next) => result
   * @param {object} [options] - Options
   * @param {number} [options.priority] - Sort priority (lower runs first)
   * @param {string} [options.id] - Optional identifier for introspection/removal
   * @returns {function(): void} Uninstaller function
   * @example
   * // Logging middleware
   * const uninstall = bl.use(async (ctx, next) => {
   *   console.log(`${ctx.verb} ${ctx.uri}`)
   *   return next()
   * }, { priority: 10, id: 'logger' })
   *
   * // Later: uninstall()
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
      this.middleware = this.middleware.filter((m) => m !== entry)
    }
  }

  /**
   * Register a tap to observe operations
   * Taps are called after handlers complete - they observe but don't intercept
   * @param {'get'|'put'} verb - Which operation to observe
   * @param {Tap} fn - Tap function
   * @returns {this} For chaining
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
   * @param {string} pattern - URL pattern with :param placeholders (e.g., '/cells/:name', '/data/:path*')
   * @param {RouteConfig} config - Route configuration with get/put handlers
   * @returns {this} For chaining
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
    const existing = this.routes.find((r) => r.pattern === pattern)
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

      const litsA = a.pattern.split('/').filter((s) => s && !s.startsWith(':')).length
      const litsB = b.pattern.split('/').filter((s) => s && !s.startsWith(':')).length
      return litsB - litsA
    })
  }

  /**
   * @param path
   * @private
   */
  _match(path) {
    for (const route of this.routes) {
      const match = path.match(route.regex)
      if (match) {
        const params = {}
        route.paramNames.forEach((name, i) => (params[name] = match[i + 1]))
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
   * @param {string} uri - Full URI (e.g., 'bl:///cells/counter')
   * @param {Headers} [headers] - Request headers
   * @returns {Promise<Response|null>} Response or null if no matching route
   * @example
   * const response = await bl.get('bl:///cells/counter', { auth: 'token' })
   * console.log(response.headers.type)  // 'cell'
   * console.log(response.body.value)    // 'bl:///cells/counter/value'
   */
  async get(uri, headers = {}) {
    const url = new URL(uri)
    const matched = this._match(url.pathname)
    if (!matched?.route.config.get) {
      this.plumb(uri, 'route-not-found', {
        headers: { type: 'bl:///types/route-not-found' },
        body: { uri, method: 'GET' },
      })
      return null
    }

    const ctx = {
      verb: 'get',
      uri,
      params: matched.params,
      headers,
      query: url.searchParams,
      bl: this,
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
   * Send a message through the plumber
   * Falls back to console.warn if plumber not installed
   * @param {string} source - Source URI (e.g., 'bl:///cells/counter')
   * @param {string} port - Port name (e.g., 'cell-updates', 'resource-removed')
   * @param {object} options - Message options
   * @param {object} [options.headers] - Message headers (including type)
   * @param {*} [options.body] - Message body
   * @returns {Promise<Response|null>} Response from plumber or undefined if not installed
   * @example
   * bl.plumb('bl:///cells/counter', 'resource-removed', {
   *   headers: { type: 'bl:///types/resource-removed' },
   *   body: { uri: 'bl:///cells/counter' }
   * })
   */
  plumb(source, port, { headers = {}, body = {} } = {}) {
    if (this._plumber) {
      return this.put('bl:///plumb/send', { source, port }, { headers, body })
    } else {
      console.warn(`[plumb] ${port}: ${source}`, { headers, body })
    }
  }

  /**
   * PUT to a resource by URI
   * @param {string} uri - Full URI (e.g., 'bl:///cells/counter/write')
   * @param {Headers} [headers] - Request headers
   * @param {*} body - Request body
   * @returns {Promise<Response|null>} Response or null if no matching route
   * @example
   * const response = await bl.put('bl:///cells/counter/write', {}, 42)
   */
  async put(uri, headers = {}, body) {
    const url = new URL(uri)
    const matched = this._match(url.pathname)
    if (!matched?.route.config.put) {
      this.plumb(uri, 'route-not-found', {
        headers: { type: 'bl:///types/route-not-found' },
        body: { uri, method: 'PUT' },
      })
      return null
    }

    const ctx = {
      verb: 'put',
      uri,
      params: matched.params,
      headers,
      query: url.searchParams,
      body,
      bl: this,
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
   * Mount a resource at a specific path prefix
   *
   * This is the primary way to add routes from a `resource()` definition.
   * Routes defined in the resource are relative to the mount point.
   * @param {string} prefix - Path prefix to mount at (e.g., '/cells', '/v2/cells', '/ns/:ns/cells')
   * @param {import('./router.js').RouterBuilder} routerBuilder - Router builder with route definitions
   * @returns {this} For chaining
   * @example
   * import { resource } from './router.js'
   *
   * const cellResource = resource(r => {
   *   r.get('/', () => ({ headers: {}, body: listCells() }))
   *   r.get('/:name', ({ params }) => ({ headers: {}, body: getCell(params.name) }))
   * })
   *
   * // Mount at different paths
   * bl.mount('/cells', cellResource)
   * bl.mount('/v2/cells', cellResource)
   *
   * // Mount with inherited params
   * bl.mount('/namespaces/:ns/cells', cellResource)
   * // Handlers receive params.ns from the mount prefix
   */
  mount(prefix, routerBuilder) {
    // Normalize prefix: no trailing slash, empty string for root
    const normalizedPrefix = prefix === '/' ? '' : prefix.replace(/\/$/, '')

    for (const { pattern, config } of routerBuilder.definitions) {
      // Pattern from resource is relative (e.g., '/', '/:name', '/:name/value')
      // Combine with mount prefix
      let fullPattern
      if (pattern === '' || pattern === '/') {
        fullPattern = normalizedPrefix || '/'
      } else {
        fullPattern = normalizedPrefix + pattern
      }
      this.route(fullPattern, config)
    }
    return this
  }

  /**
   * Install routes from a RouterBuilder
   *
   * For `routes()` builders (with fixed prefix), installs at their defined paths.
   * For `resource()` builders (no prefix), mounts at root '/'.
   * Use `mount()` instead for explicit control over where resources are mounted.
   * @param {import('./router.js').RouterBuilder} routerBuilder - Router builder with route definitions
   * @returns {this} For chaining
   * @example
   * import { routes, resource } from './router.js'
   *
   * // Traditional routes with fixed prefix
   * const cellRoutes = routes('/cells/:name', r => {
   *   r.get('/', (params) => ({ headers: {}, body: 'cell' }))
   * })
   * bl.install(cellRoutes)  // mounted at /cells/:name
   *
   * // Resource without prefix - mounts at root
   * const indexResource = resource(r => {
   *   r.get('/', () => ({ headers: {}, body: 'index' }))
   * })
   * bl.install(indexResource)  // mounted at /
   */
  install(routerBuilder) {
    if (routerBuilder.isResource) {
      // Resource without fixed prefix - mount at root
      return this.mount('/', routerBuilder)
    }
    // Traditional routes() with fixed prefix
    routerBuilder.install(this)
    return this
  }
}
