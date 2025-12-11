/**
 * Handler Registry
 *
 * Stores handler factories (built-in) and custom handler definitions.
 * Provides a unified interface for registering and retrieving handlers.
 */

/**
 * Create a handler registry.
 *
 * @returns {object} Registry with handler management functions
 */
export function createHandlerRegistry() {
  /** @type {Map<string, function>} handler name → factory function */
  const builtins = new Map()

  /** @type {Map<string, {definition: any, description: string, createdAt: string, compiled: function}>} */
  const custom = new Map()

  /** @type {function|null} Compiler function, set later to avoid circular dependency */
  let compiler = null

  /**
   * Set the compiler function for custom handlers.
   * @param {function} fn - Compiler function
   */
  function setCompiler(fn) {
    compiler = fn
  }

  /**
   * Register a built-in handler factory.
   * @param {string} name - Handler name
   * @param {function} factory - Factory function (ctx, ...compiledArgs) => handler
   */
  function registerBuiltin(name, factory) {
    builtins.set(name, factory)
  }

  /**
   * Register multiple built-in handlers from a registration function.
   * @param {function} registerFn - Function that calls registerBuiltin for each handler
   */
  function registerAll(registerFn) {
    registerFn({ registerBuiltin, get, getFactory })
  }

  /**
   * Register a custom handler with a definition.
   * @param {string} name - Handler name
   * @param {any} definition - Hiccup-style definition
   * @param {string} [description] - Handler description
   * @returns {object} The created handler entry
   */
  function registerCustom(name, definition, description = '') {
    if (!compiler) {
      throw new Error('Compiler not set - call setCompiler first')
    }

    const compiled = compiler(definition)
    const handler = {
      definition,
      description,
      createdAt: custom.get(name)?.createdAt || new Date().toISOString(),
      compiled
    }

    custom.set(name, handler)
    return handler
  }

  /**
   * Delete a custom handler.
   * @param {string} name - Handler name
   * @returns {boolean} Whether the handler existed
   */
  function deleteCustom(name) {
    return custom.delete(name)
  }

  /**
   * Get a handler by name.
   * @param {string} name - Handler name (can be URI like 'bl:///handlers/foo' or just 'foo')
   * @param {object} [config] - Config to pass to factory
   * @returns {function|null}
   */
  function get(name, config = {}) {
    // Strip bl:///handlers/ prefix if present
    const handlerName = name.replace(/^bl:\/\/\/handlers\//, '')

    // Check custom handlers first
    const customHandler = custom.get(handlerName)
    if (customHandler) {
      // Custom handlers are pre-compiled with their config baked in.
      if (config && Object.keys(config).length > 0) {
        console.warn(
          `Config passed to custom handler '${handlerName}' will be ignored. ` +
          `Custom handlers have their config baked into their definition.`
        )
      }
      return customHandler.compiled
    }

    // Then built-in factories
    const factory = builtins.get(handlerName)
    if (!factory) return null
    return factory(config)
  }

  /**
   * Get a handler factory by name (for combinators that need to pass compiled args).
   * @param {string} name - Handler name
   * @returns {function|null}
   */
  function getFactory(name) {
    const handlerName = name.replace(/^bl:\/\/\/handlers\//, '')
    return builtins.get(handlerName) || null
  }

  /**
   * Get custom handler metadata.
   * @param {string} name - Handler name
   * @returns {object|null}
   */
  function getCustom(name) {
    return custom.get(name) || null
  }

  /**
   * Check if a handler exists.
   * @param {string} name - Handler name
   * @returns {boolean}
   */
  function has(name) {
    const handlerName = name.replace(/^bl:\/\/\/handlers\//, '')
    return builtins.has(handlerName) || custom.has(handlerName)
  }

  /**
   * Check if a handler is built-in.
   * @param {string} name - Handler name
   * @returns {boolean}
   */
  function isBuiltin(name) {
    const handlerName = name.replace(/^bl:\/\/\/handlers\//, '')
    return builtins.has(handlerName) && !custom.has(handlerName)
  }

  /**
   * List all handler names.
   * @returns {string[]}
   */
  function listAll() {
    return [...new Set([...builtins.keys(), ...custom.keys()])]
  }

  /**
   * List built-in handler names.
   * @returns {string[]}
   */
  function listBuiltin() {
    return [...builtins.keys()]
  }

  /**
   * List custom handler names.
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
    getFactory,
    getCustom,
    has,
    isBuiltin,
    listAll,
    listBuiltin,
    listCustom,
    _builtins: builtins,
    _custom: custom
  }
}
