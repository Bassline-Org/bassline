import { createPropagatorRoutes } from './propagator.js'

/**
 * Install propagators into a Bassline instance.
 * Registers the propagators on bl._propagators for cells to use.
 * Requires bl._handlers to be installed first (from @bassline/handlers).
 * Uses bl._plumber for resource removal notifications if available.
 *
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} [config] - Configuration options (currently unused)
 */
export default function installPropagators(bl, config = {}) {
  const propagators = createPropagatorRoutes({
    bl,
    onPropagatorKill: ({ uri }) => {
      bl._plumber?.dispatch({
        uri,
        headers: { type: 'bl:///types/resource-removed' },
        body: { uri },
      })
    },
  })

  propagators.install(bl)
  bl._propagators = propagators
}
