import { resource } from '@bassline/core'
import { ports, types } from '@bassline/plumber'

/**
 * Create propagator routes for reactive constraint networks.
 *
 * Propagators watch cells and fire immediately when inputs change.
 * Each propagator creates its own plumber rules for its inputs,
 * so routing is visible and self-contained.
 *
 * Handlers are provided by @bassline/handlers and accessed via bl._handlers.
 *
 * Resource structure:
 * - GET  /propagators           → list all propagators
 * - GET  /propagators/:name     → get propagator config
 * - PUT  /propagators/:name     → create/update propagator
 * - PUT  /propagators/:name/fire → fire propagator (called by plumber)
 * - PUT  /propagators/:name/kill → remove propagator
 * @param {object} options - Configuration
 * @param {object} options.bl - Bassline instance for reading/writing cells
 * @returns {object} Propagator routes and control functions
 */
export function createPropagatorRoutes(options = {}) {
  const { bl } = options

  /** @type {Map<string, {inputs: string[], output: string, handler: Function, handlerName: string, handlerConfig: object, enabled: boolean}>} */
  const store = new Map()

  /**
   * Get a handler from bl._handlers.
   * @param {string} name - Handler name
   * @param {object} [config] - Handler config
   * @returns {Function | null}
   */
  function getHandler(name, config = {}) {
    if (!bl?._handlers) {
      throw new Error('Handlers not installed. Install @bassline/handlers before propagators.')
    }
    return bl._handlers.get(name, config)
  }

  /**
   * Get the plumber rule name for a propagator input
   * @param {string} propagatorName - Propagator name
   * @param {number} inputIndex - Input index
   * @returns {string} Rule name
   */
  function getRuleName(propagatorName, inputIndex) {
    return `propagator-${propagatorName}-input-${inputIndex}`
  }

  /**
   * Create plumber rules for a propagator's inputs
   * @param {string} name - Propagator name
   * @param {string[]} inputs - Input cell URIs
   */
  async function createInputRules(name, inputs) {
    for (let i = 0; i < inputs.length; i++) {
      const inputUri = inputs[i]
      const ruleName = getRuleName(name, i)
      await bl.put(
        `bl:///plumb/rules/${ruleName}`,
        {},
        {
          match: {
            source: `^${inputUri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            port: 'cell-updates',
          },
          to: `bl:///propagators/${name}/fire`,
        }
      )
    }
  }

  /**
   * Remove plumber rules for a propagator's inputs
   * @param {string} name - Propagator name
   * @param {string[]} inputs - Input cell URIs
   */
  async function removeInputRules(name, inputs) {
    for (let i = 0; i < inputs.length; i++) {
      const ruleName = getRuleName(name, i)
      await bl.put(`bl:///plumb/rules/${ruleName}/kill`, {}, {}).catch(() => {})
    }
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
   * @param {boolean} [config.enabled] - Whether propagator is active
   * @returns {Promise<object>} The created propagator
   */
  async function createPropagator(name, config) {
    const existing = store.get(name)

    // Remove old plumber rules if updating
    if (existing) {
      await removeInputRules(name, existing.inputs)
    }

    // Resolve handler
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
      enabled: config.enabled !== false,
    }

    store.set(name, propagator)

    // Create plumber rules for each input
    if (propagator.inputs.length > 0) {
      await createInputRules(name, propagator.inputs)
    }

    // Fire once on creation to compute initial value from existing inputs
    if (bl && propagator.inputs.length > 0) {
      await fire(name).catch((err) => {
        console.warn(`Propagator ${name} initial fire failed:`, err.message)
      })
    }

    return propagator
  }

  /**
   * Remove a propagator and its plumber rules
   * @param {string} name
   */
  async function removePropagator(name) {
    const propagator = store.get(name)
    if (propagator) {
      await removeInputRules(name, propagator.inputs)
      store.delete(name)
    }
  }

  /**
   * Kill (remove) a propagator with plumber notification
   * @param {string} name - Propagator name
   * @returns {Promise<boolean>} Whether the propagator existed and was removed
   */
  async function killPropagator(name) {
    const existed = store.has(name)
    if (existed) {
      await removePropagator(name)
      const source = `bl:///propagators/${name}`
      bl?.plumb(source, ports.RESOURCE_REMOVED, {
        headers: { type: types.RESOURCE_REMOVED },
        body: { source },
      })
    }
    return existed
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

    // Skip write if handler returns undefined (for filter semantics)
    if (outputValue === undefined) {
      return { fired: true, skipped: true }
    }

    // Write to output cell
    await bl.put(`${propagator.output}/value`, {}, outputValue)

    return { fired: true, result: outputValue }
  }

  /**
   * List all propagators
   * @returns {string[]}
   */
  function listPropagators() {
    return [...store.keys()]
  }

  const propagatorResource = resource((r) => {
    // List all propagators
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: listPropagators().map((name) => ({
          name,
          type: 'propagator',
          uri: `bl:///propagators/${name}`,
        })),
      },
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
          enabled: prop.enabled,
        },
      }
    })

    // Create/update a propagator
    r.put('/:name', async ({ params, body }) => {
      const isNew = !store.has(params.name)
      const config = {
        inputs: body.inputs || [],
        output: body.output,
        handler: body.handler || 'passthrough',
        handlerConfig: body.handlerConfig || {},
        enabled: body.enabled !== false,
      }

      const prop = await createPropagator(params.name, config)
      const source = `bl:///propagators/${params.name}`

      // Emit lifecycle event
      if (isNew) {
        bl?.plumb(source, ports.RESOURCE_CREATED, {
          headers: { type: types.RESOURCE_CREATED },
          body: { source, resourceType: 'propagator', config },
        })
      } else {
        bl?.plumb(source, ports.RESOURCE_UPDATED, {
          headers: { type: types.RESOURCE_UPDATED },
          body: { source, resourceType: 'propagator', changes: config },
        })
      }

      return {
        headers: { type: 'bl:///types/propagator' },
        body: {
          inputs: prop.inputs,
          output: prop.output,
          handler: prop.handlerName,
          handlerConfig: prop.handlerConfig,
          enabled: prop.enabled,
        },
      }
    })

    // Fire a propagator (called by plumber when inputs change)
    r.put('/:name/fire', async ({ params }) => {
      const result = await fire(params.name)
      return {
        headers: { type: 'bl:///types/propagator-result' },
        body: result,
      }
    })

    // Kill (remove) a propagator
    r.put('/:name/kill', async ({ params }) => {
      const existed = await killPropagator(params.name)
      if (!existed) return null

      return {
        headers: { type: 'bl:///types/resource-removed' },
        body: { source: `bl:///propagators/${params.name}` },
      }
    })
  })

  /**
   * Install propagator routes into a Bassline instance
   * @param {import('@bassline/core').Bassline} blInstance
   * @param {object} [options] - Options
   * @param {string} [options.prefix] - Mount prefix
   */
  function install(blInstance, { prefix = '/propagators' } = {}) {
    blInstance.mount(prefix, propagatorResource)
  }

  return {
    routes: propagatorResource,
    install,
    getPropagator,
    createPropagator,
    removePropagator,
    killPropagator,
    fire,
    listPropagators,
    _store: store,
  }
}
