import { createMonitorRoutes } from './monitor.js'

/**
 * Install monitors into a Bassline instance.
 *
 * Monitors compose Timer + Fetch + Cell to create automated
 * URL polling pipelines. One PUT creates everything needed
 * to poll a URL at an interval and store the result.
 *
 * @param {import('@bassline/core').Bassline} bl
 */
export default function installMonitors(bl) {
  const monitors = createMonitorRoutes({ bl })
  monitors.install(bl)

  // Expose for other modules
  bl._monitors = monitors

  console.log('Monitors installed')
}
