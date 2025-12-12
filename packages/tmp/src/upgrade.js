/**
 * Tmp Module Upgrade
 *
 * Installs ephemeral state and temporary function routes into a Bassline instance.
 */

import { createTmpStateRoutes } from './state.js'
import { createTmpFnRoutes } from './fn.js'

/**
 * Install tmp routes into a Bassline instance.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 */
export default function installTmp(bl) {
  // Install state routes at /tmp/state
  const state = createTmpStateRoutes({ bl })
  state.install(bl)

  // Install fn routes at /tmp/fn
  const fn = createTmpFnRoutes({ bl })
  fn.install(bl)

  // Register as module for discovery
  bl.setModule('tmp', {
    state,
    fn,
  })

  console.log('Tmp installed: /tmp/state, /tmp/fn')
}
