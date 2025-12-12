/**
 * Function Registry
 *
 * Stores function factories (built-in) and custom function definitions.
 * Provides a unified interface for registering and retrieving functions.
 * Uses promise-based late binding - get() returns a promise that resolves
 * when the function becomes available.
 *
 * Functions are keyed by full URI (e.g., 'bl:///fn/sum', 'bl:///tmp/fn/double').
 */

/**
 * Create a function registry.
 * @returns {object} Registry with function management functions
 */
export function createFnRegistry() {
  /** @type {Map<string, Function>} URI → factory function */
  const builtins = new Map()

  /** @type {Map<string, {definition: any, description: string, createdAt: string, compiled: Function}>} */
  const custom = new Map()

  /** @type {Map<string, Array<{resolve: Function, config: object}>>} pending get() calls */
  const pending = new Map()

  /** @type {Function | null} Compiler function, set later to avoid circular dependency */
  let compiler = null

  /**
   * Set the compiler function for custom functions.
   * @param {Function} fn - Compiler function
   */
  function setCompiler(fn) {
    compiler = fn
  }

  /**
   * Resolve any pending get() calls for a function
   * @param {string} uri - Function URI
   */
  function resolvePending(uri) {
    const waiters = pending.get(uri)
    if (waiters) {
      for (const { resolve, config } of waiters) {
        resolve(getSync(uri, config))
      }
      pending.delete(uri)
    }
  }

  /**
   * Register a built-in function factory.
   * Resolves any pending get() calls for this function.
   * @param {string} uri - Function URI (e.g., 'bl:///fn/sum')
   * @param {Function} factory - Factory function (ctx, ...compiledArgs) => fn
   */
  function registerBuiltin(uri, factory) {
    builtins.set(uri, factory)
    resolvePending(uri)
  }

  /**
   * Register multiple built-in functions from a registration function.
   * @param {Function} registerFn - Function that calls registerBuiltin for each function
   */
  function registerAll(registerFn) {
    registerFn({ registerBuiltin, get, getFactory })
  }

  /**
   * Register a custom function with a definition.
   * Resolves any pending get() calls for this function.
   * @param {string} uri - Function URI (e.g., 'bl:///fn/my-fn' or 'bl:///tmp/fn/temp')
   * @param {any} definition - Hiccup-style definition
   * @param {string} [description] - Function description
   * @returns {object} The created function entry
   */
  function registerCustom(uri, definition, description = '') {
    if (!compiler) {
      throw new Error('Compiler not set - call setCompiler first')
    }

    const compiled = compiler(definition)
    const fn = {
      definition,
      description,
      createdAt: custom.get(uri)?.createdAt || new Date().toISOString(),
      compiled,
    }

    custom.set(uri, fn)
    resolvePending(uri)
    return fn
  }

  /**
   * Delete a custom function.
   * @param {string} uri - Function URI
   * @returns {boolean} Whether the function existed
   */
  function deleteCustom(uri) {
    return custom.delete(uri)
  }

  /**
   * Get a function by URI synchronously.
   * Returns null if function not found. Use get() for promise-based late binding.
   * @param {string} uri - Function URI (e.g., 'bl:///fn/sum')
   * @param {object} [config] - Config to pass to factory
   * @returns {Function | null}
   */
  function getSync(uri, config = {}) {
    // Check custom functions first
    const customFn = custom.get(uri)
    if (customFn) {
      // Custom functions are pre-compiled with their config baked in.
      if (config && Object.keys(config).length > 0) {
        console.warn(
          `Config passed to custom function '${uri}' will be ignored. ` +
            `Custom functions have their config baked into their definition.`
        )
      }
      return customFn.compiled
    }

    // Then built-in factories
    const factory = builtins.get(uri)
    if (!factory) return null
    // Inject get into ctx so combinators can look up other functions
    return factory({ ...config, get: getSync })
  }

  /**
   * Get a function by URI, waiting if not yet available.
   * Returns a promise that resolves when the function is registered.
   * @param {string} uri - Function URI (e.g., 'bl:///fn/sum')
   * @param {object} [config] - Config to pass to factory
   * @returns {Promise<Function>} Promise that resolves to the function
   */
  function get(uri, config = {}) {
    // Check if function exists
    const fn = getSync(uri, config)
    if (fn) {
      return Promise.resolve(fn)
    }

    // Wait for function to be registered
    return new Promise((resolve) => {
      if (!pending.has(uri)) {
        pending.set(uri, [])
      }
      pending.get(uri).push({ resolve, config })
    })
  }

  /**
   * Get a function factory by URI (for combinators that need to pass compiled args).
   * @param {string} uri - Function URI
   * @returns {Function | null}
   */
  function getFactory(uri) {
    return builtins.get(uri) || null
  }

  /**
   * Get custom function metadata.
   * @param {string} uri - Function URI
   * @returns {object|null}
   */
  function getCustom(uri) {
    return custom.get(uri) || null
  }

  /**
   * Check if a function exists.
   * @param {string} uri - Function URI
   * @returns {boolean}
   */
  function has(uri) {
    return builtins.has(uri) || custom.has(uri)
  }

  /**
   * Check if a function is built-in.
   * @param {string} uri - Function URI
   * @returns {boolean}
   */
  function isBuiltin(uri) {
    return builtins.has(uri) && !custom.has(uri)
  }

  /**
   * List all function URIs.
   * @returns {string[]}
   */
  function listAll() {
    return [...new Set([...builtins.keys(), ...custom.keys()])]
  }

  /**
   * List built-in function URIs.
   * @returns {string[]}
   */
  function listBuiltin() {
    return [...builtins.keys()]
  }

  /**
   * List custom function URIs.
   * @returns {string[]}
   */
  function listCustom() {
    return [...custom.keys()]
  }

  return {
    setCompiler,
    registerBuiltin,
    registerAll,
    registerCustom,
    deleteCustom,
    get,
    getSync,
    getFactory,
    getCustom,
    has,
    isBuiltin,
    listAll,
    listBuiltin,
    listCustom,
    _builtins: builtins,
    _custom: custom,
    _pending: pending,
  }
}

// Keep old name as alias for backward compatibility during migration
export const createHandlerRegistry = createFnRegistry
