import { createPropagatorRoutes } from './propagator.js'

/**
 * Install propagators into a Bassline instance.
 * Registers the propagators on bl._propagators for cells to use.
 * Uses bl._plumber for resource removal notifications if available.
 *
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} [config] - Configuration options
 * @param {object} [config.handlers] - Custom handlers to register { name: factory }
 */
export default function installPropagators(bl, config = {}) {
  const propagators = createPropagatorRoutes({
    bl,
    onPropagatorKill: ({ uri }) => {
      bl._plumber?.dispatch({
        uri,
        headers: { type: 'bl:///types/resource-removed' },
        body: { uri }
      })
    }
  })

  propagators.install(bl)
  bl._propagators = propagators

  // Register custom handlers from config
  if (config.handlers) {
    for (const [name, factory] of Object.entries(config.handlers)) {
      propagators.registerHandler(name, factory)
    }
  }
}
