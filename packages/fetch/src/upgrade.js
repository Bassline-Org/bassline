import { createFetchRoutes } from './fetch.js'

/**
 * Install fetch into a Bassline instance.
 * Fetch dispatches response/error events through the plumber.
 *
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} [config] - Configuration options (unused)
 */
export default function installFetch(bl, config = {}) {
  const fetchService = createFetchRoutes({
    bl,
    onResponse: ({ requestId, url, method, status, statusText, headers, body, responseCell }) => {
      bl._plumber?.dispatch({
        uri: `bl:///fetch/${requestId}`,
        headers: {
          type: 'bl:///types/fetch-response',
          status
        },
        body: {
          requestId,
          url,
          method,
          status,
          statusText,
          headers,
          body,
          responseCell
        }
      })
    },
    onError: ({ requestId, url, method, error }) => {
      bl._plumber?.dispatch({
        uri: `bl:///fetch/${requestId}`,
        headers: {
          type: 'bl:///types/fetch-error'
        },
        body: {
          requestId,
          url,
          method,
          error
        }
      })
    }
  })

  fetchService.install(bl)
  bl._fetch = fetchService

  console.log('Fetch installed')
}
