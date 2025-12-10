import { routes } from '@bassline/core'

/**
 * Create propagator routes for reactive constraint networks.
 *
 * Propagators watch cells and fire immediately when inputs change.
 * Since cells are ACI, no scheduler is needed - propagators fire
 * synchronously and the network naturally terminates.
 *
 * Handlers are registered as factories that receive a context object.
 * Built-in handlers: sum, product, min, max, passthrough
 *
 * Resource structure:
 * - GET  /propagators           → list all propagators
 * - GET  /propagators/:name     → get propagator config
 * - PUT  /propagators/:name     → create/update propagator
 * - GET  /propagators/:name/fire → manually fire (for debugging)
 *
 * @param {object} options - Configuration
 * @param {object} options.bl - Bassline instance for reading/writing cells
 * @returns {object} Propagator routes and control functions
 */
export function createPropagatorRoutes(options = {}) {
  const { bl } = options

  /** @type {Map<string, {inputs: string[], output: string, handler: function, handlerName: string, config: object, enabled: boolean}>} */
  const store = new Map()

  /** @type {Map<string, Set<string>>} cell URI → Set of propagator names */
  const watchers = new Map()

  /** @type {Map<string, function>} handler name → factory function */
  const handlerFactories = new Map()

  // Register built-in handler factories
  handlerFactories.set('sum', () => (...values) =>
    values.reduce((a, b) => (a ?? 0) + (b ?? 0), 0)
  )

  handlerFactories.set('product', () => (...values) =>
    values.reduce((a, b) => (a ?? 1) * (b ?? 1), 1)
  )

  handlerFactories.set('min', () => (...values) =>
    Math.min(...values.filter(v => v != null))
  )

  handlerFactories.set('max', () => (...values) =>
    Math.max(...values.filter(v => v != null))
  )

  handlerFactories.set('passthrough', () => (value) => value)

  handlerFactories.set('constant', (ctx) => () => ctx.value)

  /**
   * Register a handler factory
   * @param {string} name - Handler name
   * @param {function} factory - Factory function (ctx) => handler
   */
  function registerHandler(name, factory) {
    handlerFactories.set(name, factory)
  }

  /**
   * Get a handler by creating it from a factory
   * @param {string} name - Handler name
   * @param {object} config - Config to pass to factory
   * @returns {function|null}
   */
  function getHandler(name, config = {}) {
    const factory = handlerFactories.get(name)
    if (!factory) return null
    return factory(config)
  }

  /**
   * Get a propagator by name
   * @param {string} name
   * @returns {object|null}
   */
  function getPropagator(name) {
    return store.get(name) || null
  }

  /**
   * Register a propagator
   * @param {string} name - Propagator name
   * @param {object} config - Propagator config
   * @param {string[]} config.inputs - Cell URIs to watch
   * @param {string} config.output - Cell URI to write to
   * @param {string} config.handler - Handler name (references a registered factory)
   * @param {object} [config.handlerConfig] - Config to pass to handler factory
   * @param {boolean} [config.enabled=true] - Whether propagator is active
   */
  function createPropagator(name, config) {
    const existing = store.get(name)

    // Unregister old watchers if updating
    if (existing) {
      for (const inputUri of existing.inputs) {
        watchers.get(inputUri)?.delete(name)
      }
    }

    // Resolve handler from factory
    const handlerName = config.handler || 'passthrough'
    const handlerConfig = config.handlerConfig || {}
    const handler = getHandler(handlerName, handlerConfig)

    if (!handler) {
      throw new Error(`Unknown handler: ${handlerName}`)
    }

    const propagator = {
      inputs: config.inputs || [],
      output: config.output,
      handler,
      handlerName,
      handlerConfig,
      enabled: config.enabled !== false
    }

    store.set(name, propagator)

    // Register watchers for each input
    for (const inputUri of propagator.inputs) {
      if (!watchers.has(inputUri)) {
        watchers.set(inputUri, new Set())
      }
      watchers.get(inputUri).add(name)
    }

    // Fire once on creation to compute initial value from existing inputs
    if (bl && propagator.inputs.length > 0) {
      fire(name).catch(err => {
        console.warn(`Propagator ${name} initial fire failed:`, err.message)
      })
    }

    return propagator
  }

  /**
   * Remove a propagator
   * @param {string} name
   */
  function removePropagator(name) {
    const propagator = store.get(name)
    if (propagator) {
      for (const inputUri of propagator.inputs) {
        watchers.get(inputUri)?.delete(name)
      }
      store.delete(name)
    }
  }

  /**
   * Fire a propagator - read inputs, call handler, write output
   * @param {string} name - Propagator name
   * @returns {Promise<{fired: boolean, result?: any}>}
   */
  async function fire(name) {
    const propagator = store.get(name)
    if (!propagator || !propagator.enabled) {
      return { fired: false }
    }

    if (!bl) {
      console.warn(`Propagator ${name}: no Bassline instance, cannot fire`)
      return { fired: false }
    }

    // Read all input values
    const inputValues = []
    for (const inputUri of propagator.inputs) {
      const result = await bl.get(`${inputUri}/value`)
      inputValues.push(result?.body)
    }

    // Call the handler
    let outputValue
    try {
      outputValue = propagator.handler(...inputValues)
    } catch (err) {
      console.error(`Propagator ${name} handler error:`, err)
      return { fired: false, error: err.message }
    }

    // Write to output cell
    await bl.put(`${propagator.output}/value`, {}, outputValue)

    return { fired: true, result: outputValue }
  }

  /**
   * Handle cell change - fire all watching propagators
   * @param {string} cellUri - The cell that changed
   */
  async function onCellChange(cellUri) {
    const watching = watchers.get(cellUri)
    if (!watching) return

    for (const propagatorName of watching) {
      await fire(propagatorName)
    }
  }

  /**
   * List all propagators
   * @returns {string[]}
   */
  function listPropagators() {
    return [...store.keys()]
  }

  const propagatorRoutes = routes('/propagators', r => {
    // List all propagators
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: listPropagators().map(name => ({
          name,
          type: 'propagator',
          uri: `bl:///propagators/${name}`
        }))
      }
    }))

    // Get a propagator
    r.get('/:name', ({ params }) => {
      const prop = getPropagator(params.name)
      if (!prop) return null

      return {
        headers: { type: 'bl:///types/propagator' },
        body: {
          inputs: prop.inputs,
          output: prop.output,
          handler: prop.handlerName,
          handlerConfig: prop.handlerConfig,
          enabled: prop.enabled
        }
      }
    })

    // Create/update a propagator
    r.put('/:name', ({ params, body }) => {
      const config = {
        inputs: body.inputs || [],
        output: body.output,
        handler: body.handler || 'passthrough',
        handlerConfig: body.handlerConfig || {},
        enabled: body.enabled !== false
      }

      const prop = createPropagator(params.name, config)

      return {
        headers: { type: 'bl:///types/propagator' },
        body: {
          inputs: prop.inputs,
          output: prop.output,
          handler: prop.handlerName,
          handlerConfig: prop.handlerConfig,
          enabled: prop.enabled
        }
      }
    })

    // Manually fire a propagator (for debugging)
    r.get('/:name/fire', async ({ params }) => {
      const result = await fire(params.name)
      return {
        headers: { type: 'bl:///types/propagator-result' },
        body: result
      }
    })
  })

  /**
   * Install propagator routes into a Bassline instance
   * @param {import('@bassline/core').Bassline} blInstance
   */
  function install(blInstance) {
    blInstance.install(propagatorRoutes)
  }

  return {
    routes: propagatorRoutes,
    install,
    registerHandler,
    getPropagator,
    createPropagator,
    removePropagator,
    fire,
    onCellChange,
    listPropagators,
    listHandlers: () => [...handlerFactories.keys()],
    _store: store,
    _watchers: watchers,
    _handlers: handlerFactories
  }
}
