/**
 * Widget Registry
 *
 * Stores widget primitives (platform-specific) and custom widget definitions.
 * Provides a unified interface for registering and retrieving widgets.
 * Uses promise-based late binding - get() returns a promise that resolves
 * when the widget becomes available.
 *
 * Widgets are keyed by full URI (e.g., 'bl:///widgets/button', 'bl:///widgets/login-form').
 */

/**
 * Create a widget registry.
 * @returns {object} Registry with widget management functions
 */
export function createWidgetRegistry() {
  /** @type {Map<string, {type: string, props: object, render: Function}>} URI → primitive widget */
  const primitives = new Map()

  /** @type {Map<string, {type: string, name: string, props: object, definition: any, description: string, createdAt: string}>} */
  const custom = new Map()

  /** @type {Map<string, Array<{resolve: Function}>>} pending get() calls */
  const pending = new Map()

  /** @type {Function | null} Compiler function, set later to avoid circular dependency */
  // eslint-disable-next-line no-unused-vars
  let _compiler = null

  /**
   * Set the compiler function for resolving widget definitions.
   * @param {Function} fn - Compiler function
   */
  function setCompiler(fn) {
    _compiler = fn
  }

  /**
   * Resolve any pending get() calls for a widget
   * @param {string} uri - Widget URI
   */
  function resolvePending(uri) {
    const waiters = pending.get(uri)
    if (waiters) {
      for (const { resolve } of waiters) {
        resolve(getSync(uri))
      }
      pending.delete(uri)
    }
  }

  /**
   * Register a primitive widget (platform-specific implementation).
   * Primitives are registered by platform renderers (React, Solid, etc.).
   * @param {string} name - Widget name (e.g., 'button', 'stack')
   * @param {object} config - Primitive configuration
   * @param {string} config.type - Type URI (e.g., 'bl:///types/widgets/atom/button')
   * @param {object} [config.props] - Props schema
   * @param {Function} config.render - Platform-specific render function
   */
  function registerPrimitive(name, config) {
    const uri = `bl:///widgets/${name}`
    primitives.set(uri, {
      primitive: true,
      name,
      type: config.type,
      props: config.props || {},
      render: config.render,
    })
    resolvePending(uri)
  }

  /**
   * Register multiple primitives from a registration function.
   * @param {Function} registerFn - Function that calls registerPrimitive for each widget
   */
  function registerAll(registerFn) {
    registerFn({ registerPrimitive, get, getSync })
  }

  /**
   * Register a custom widget with a hiccup definition.
   * @param {string} uri - Widget URI (e.g., 'bl:///widgets/login-form')
   * @param {object} config - Widget configuration
   * @param {string} config.name - Widget name
   * @param {string} [config.type] - Type URI (defaults to 'bl:///types/widgets/custom')
   * @param {object} [config.props] - Props schema
   * @param {any} config.definition - Hiccup-style definition
   * @param {string} [config.description] - Widget description
   * @returns {object} The created widget entry
   */
  function registerCustom(uri, config) {
    const widget = {
      primitive: false,
      name: config.name,
      type: config.type || 'bl:///types/widgets/custom',
      props: config.props || {},
      definition: config.definition,
      description: config.description || '',
      createdAt: custom.get(uri)?.createdAt || new Date().toISOString(),
    }

    custom.set(uri, widget)
    resolvePending(uri)
    return widget
  }

  /**
   * Delete a custom widget.
   * @param {string} uri - Widget URI
   * @returns {boolean} Whether the widget existed
   */
  function deleteCustom(uri) {
    return custom.delete(uri)
  }

  /**
   * Get a widget by URI synchronously.
   * Returns null if widget not found. Use get() for promise-based late binding.
   * @param {string} uri - Widget URI
   * @returns {object | null}
   */
  function getSync(uri) {
    // Check custom widgets first (allow override of primitives)
    const customWidget = custom.get(uri)
    if (customWidget) {
      return customWidget
    }

    // Then primitives
    const primitive = primitives.get(uri)
    if (primitive) {
      return primitive
    }

    return null
  }

  /**
   * Get a widget by URI, waiting if not yet available.
   * Returns a promise that resolves when the widget is registered.
   * @param {string} uri - Widget URI
   * @returns {Promise<object>} Promise that resolves to the widget
   */
  function get(uri) {
    const widget = getSync(uri)
    if (widget) {
      return Promise.resolve(widget)
    }

    // Wait for widget to be registered
    return new Promise((resolve) => {
      if (!pending.has(uri)) {
        pending.set(uri, [])
      }
      pending.get(uri).push({ resolve })
    })
  }

  /**
   * Get custom widget metadata.
   * @param {string} uri - Widget URI
   * @returns {object|null}
   */
  function getCustom(uri) {
    return custom.get(uri) || null
  }

  /**
   * Check if a widget exists.
   * @param {string} uri - Widget URI
   * @returns {boolean}
   */
  function has(uri) {
    return primitives.has(uri) || custom.has(uri)
  }

  /**
   * Check if a widget is a primitive.
   * @param {string} uri - Widget URI
   * @returns {boolean}
   */
  function isPrimitive(uri) {
    return primitives.has(uri) && !custom.has(uri)
  }

  /**
   * List all widget URIs.
   * @returns {string[]}
   */
  function listAll() {
    return [...new Set([...primitives.keys(), ...custom.keys()])]
  }

  /**
   * List primitive widget URIs.
   * @returns {string[]}
   */
  function listPrimitives() {
    return [...primitives.keys()]
  }

  /**
   * List custom widget URIs.
   * @returns {string[]}
   */
  function listCustom() {
    return [...custom.keys()]
  }

  return {
    setCompiler,
    registerPrimitive,
    registerAll,
    registerCustom,
    deleteCustom,
    get,
    getSync,
    getCustom,
    has,
    isPrimitive,
    listAll,
    listPrimitives,
    listCustom,
    _primitives: primitives,
    _custom: custom,
    _pending: pending,
  }
}
