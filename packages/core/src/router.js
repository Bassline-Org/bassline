/**
 * @typedef {import('./bassline.js').Handler} Handler
 * @typedef {import('./bassline.js').RouteConfig} RouteConfig
 * @typedef {import('./bassline.js').Bassline} Bassline
 * @typedef {import('./bassline.js').Context} Context
 */

/**
 * @callback RouterCallback
 * @param {RouterBuilder} router - Router builder for defining routes
 * @returns {void}
 */

/**
 * @typedef {Object} RouterBuilderOptions
 * @property {boolean} [isResource=false] - Whether this is a mountable resource (no fixed prefix)
 */

/**
 * RouterBuilder - Define routes hierarchically with scoped prefixes
 *
 * @example
 * // Traditional usage with fixed prefix
 * const cellRoutes = new RouterBuilder('/cells/:name')
 * cellRoutes.get('/', (params) => ({ headers: {}, body: 'cell' }))
 * cellRoutes.get('/value', (params) => ({ headers: {}, body: 42 }))
 * cellRoutes.install(bassline)
 *
 * @example
 * // As a mountable resource (no fixed prefix)
 * const cellRoutes = new RouterBuilder('', { isResource: true })
 * cellRoutes.get('/', ...)
 * cellRoutes.get('/:name', ...)
 * // Mount at any path later via bl.mount('/cells', cellRoutes)
 */
export class RouterBuilder {
  /**
   * @param {string} [prefix=''] - URL prefix for all routes in this builder
   * @param {RouterBuilderOptions} [options={}] - Configuration options
   */
  constructor(prefix = '', options = {}) {
    /** @type {string} */
    this.prefix = prefix
    /** @type {boolean} */
    this.isResource = options.isResource ?? false
    /** @type {Array<{pattern: string, config: RouteConfig}>} */
    this.definitions = []
  }

  /**
   * Add a route with full config (get and/or put handlers)
   *
   * @param {string} pattern - Route pattern (relative to prefix). Use '/' for the prefix itself.
   * @param {RouteConfig} config - Route configuration with get/put handlers
   * @returns {this} For chaining
   *
   * @example
   * router.route('/value', {
   *   get: ({ params }) => ({ headers: {}, body: 42 }),
   *   put: ({ params, body }) => ({ headers: {}, body: 'saved' })
   * })
   */
  route(pattern, config) {
    const fullPattern = pattern === '/' ? this.prefix : this.prefix + pattern
    this.definitions.push({ pattern: fullPattern, config })
    return this
  }

  /**
   * Add a GET-only route
   *
   * @param {string} pattern - Route pattern (relative to prefix)
   * @param {Handler} handler - GET handler function
   * @returns {this} For chaining
   *
   * @example
   * router.get('/value', ({ params }) => ({
   *   headers: { type: 'scalar' },
   *   body: 42
   * }))
   */
  get(pattern, handler) {
    return this.route(pattern, { get: handler })
  }

  /**
   * Add a PUT-only route
   *
   * @param {string} pattern - Route pattern (relative to prefix)
   * @param {Handler} handler - PUT handler function
   * @returns {this} For chaining
   *
   * @example
   * router.put('/write', ({ params, body }) => {
   *   store.save(params.name, body)
   *   return { headers: {}, body: 'saved' }
   * })
   */
  put(pattern, handler) {
    return this.route(pattern, { put: handler })
  }

  /**
   * Create a nested scope with an additional prefix
   *
   * @param {string} prefix - Additional prefix for nested routes
   * @param {RouterCallback} fn - Callback to define nested routes
   * @returns {this} For chaining
   *
   * @example
   * router.scope('/posts/:postId', r => {
   *   r.get('/', ({ params }) => ({ headers: {}, body: { postId: params.postId } }))
   *   r.get('/comments', () => ({ headers: {}, body: [] }))
   * })
   */
  scope(prefix, fn) {
    const scoped = new RouterBuilder(this.prefix + prefix, { isResource: this.isResource })
    fn(scoped)
    this.definitions.push(...scoped.definitions)
    return this
  }

  /**
   * Install all defined routes into a Bassline instance
   *
   * @param {Bassline} bassline - Bassline instance to install routes into
   * @returns {Bassline} The bassline instance for chaining
   *
   * @example
   * const bl = new Bassline()
   * router.install(bl)
   */
  install(bassline) {
    for (const { pattern, config } of this.definitions) {
      bassline.route(pattern, config)
    }
    return bassline
  }
}

/**
 * Create a scoped router builder with a prefix
 *
 * @param {string} prefix - URL prefix for all routes
 * @param {RouterCallback} fn - Callback to define routes
 * @returns {RouterBuilder} Router builder with defined routes
 *
 * @example
 * const cellRoutes = routes('/cells/:name', r => {
 *   r.get('/', ({ params }) => ({
 *     headers: { type: 'cell' },
 *     body: { value: `bl:///cells/${params.name}/value` }
 *   }))
 *   r.get('/value', ({ params }) => ({
 *     headers: { type: 'scalar' },
 *     body: store.get(params.name).value
 *   }))
 *   r.put('/write', ({ params, body }) => {
 *     store.set(params.name, body)
 *     return { headers: {}, body }
 *   })
 * })
 *
 * bl.install(cellRoutes)
 */
export function routes(prefix, fn) {
  const builder = new RouterBuilder(prefix)
  fn(builder)
  return builder
}

/**
 * Create a mountable resource without a fixed prefix
 *
 * Unlike `routes()`, a resource defines routes relative to wherever it gets mounted.
 * Use `bl.mount(prefix, resource)` to mount at a specific path.
 *
 * @param {RouterCallback} fn - Callback to define routes
 * @returns {RouterBuilder} Router builder with defined routes (isResource=true)
 *
 * @example
 * // Define routes without knowing the mount point
 * const cellResource = resource(r => {
 *   r.get('/', () => ({ headers: {}, body: { entries: listCells() } }))
 *   r.get('/:name', ({ params }) => ({ headers: {}, body: getCell(params.name) }))
 *   r.put('/:name', ({ params, body }) => {
 *     createCell(params.name, body)
 *     return { headers: {}, body: 'created' }
 *   })
 *   r.scope('/:name', r => {
 *     r.get('/value', ({ params }) => ({ headers: {}, body: getValue(params.name) }))
 *     r.put('/value', ({ params, body }) => {
 *       setValue(params.name, body)
 *       return { headers: {}, body }
 *     })
 *   })
 * })
 *
 * // Mount at different paths
 * bl.mount('/cells', cellResource)
 * bl.mount('/v2/cells', cellResource)
 * bl.mount('/namespaces/:ns/cells', cellResource)  // params.ns available in handlers
 */
export function resource(fn) {
  const builder = new RouterBuilder('', { isResource: true })
  fn(builder)
  return builder
}
