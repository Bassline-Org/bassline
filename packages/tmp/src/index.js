/**
 * @module @bassline/tmp
 *
 * Ephemeral resources for Bassline.
 *
 * Provides:
 * - /tmp/state/:name* - Temporary in-memory state
 * - /tmp/fn/:name - Temporary functions
 */

import { createTmpStateRoutes } from './state.js'
import { createTmpFnRoutes } from './fn.js'

export { createTmpStateRoutes, createTmpFnRoutes }

/**
 * Create a complete tmp system with state and fn routes.
 * @param {object} options - Configuration
 * @param {object} options.bl - Bassline instance
 * @returns {object} Tmp system with routes and control functions
 */
export function createTmpSystem(options = {}) {
  const state = createTmpStateRoutes(options)
  const fn = createTmpFnRoutes(options)

  return {
    state,
    fn,
  }
}
