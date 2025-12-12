import { createFetchRoutes } from './fetch.js'

/**
 * Install fetch into a Bassline instance.
 * Fetch sends response/error events through the plumber.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 */
export default function installFetch(bl) {
  const fetchService = createFetchRoutes({ bl })

  fetchService.install(bl)
  bl.setModule('fetch', fetchService)

  console.log('Fetch installed')
}
