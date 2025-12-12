import { createPropagatorRoutes } from './propagator.js'

/**
 * Install propagators into a Bassline instance.
 * Handlers are accessed via bl.getModule('handlers') with late binding.
 * Uses plumber for resource removal notifications.
 * Each propagator creates its own plumber rules for inputs.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 */
export default function installPropagators(bl) {
  const propagators = createPropagatorRoutes({ bl })

  propagators.install(bl)
  bl.setModule('propagators', propagators)
}
