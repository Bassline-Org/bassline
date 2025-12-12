import { createPropagatorRoutes } from './propagator.js'

/**
 * Install propagators into a Bassline instance.
 * Registers the propagators on bl._propagators for cells to use.
 * Requires bl._handlers to be installed first (from @bassline/handlers).
 * Uses plumber for resource removal notifications.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 */
export default function installPropagators(bl) {
  const propagators = createPropagatorRoutes({
    bl,
    onPropagatorKill: ({ uri }) => {
      bl.put(
        'bl:///plumb/send',
        { source: uri, port: 'resource-removed' },
        { headers: { type: 'bl:///types/resource-removed' }, body: { uri } }
      )
    },
  })

  propagators.install(bl)
  bl._propagators = propagators
}
