/**
 * Install vals into a Bassline instance.
 * Registers the val routes on bl._vals for other modules to use.
 *
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} [config] - Configuration options
 */

import { createValRoutes } from './val.js'

export default function installVals(bl, config = {}) {
  const vals = createValRoutes({ bl, ...config })
  vals.install(bl)

  // Register for other modules
  bl._vals = vals

  console.log('  vals: installed')
}
