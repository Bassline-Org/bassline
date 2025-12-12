import { createFetchRoutes } from './fetch.js'

/**
 * Install fetch into a Bassline instance.
 * Fetch sends response/error events through the plumber.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 */
export default function installFetch(bl) {
  const fetchService = createFetchRoutes({
    bl,
    onResponse: ({ requestId, url, method, status, statusText, headers, body, responseCell }) => {
      bl.put(
        'bl:///plumb/send',
        { source: `bl:///fetch/${requestId}`, port: 'fetch-responses' },
        {
          headers: { type: 'bl:///types/fetch-response', status },
          body: {
            requestId,
            url,
            method,
            status,
            statusText,
            headers,
            body,
            responseCell,
          },
        }
      )
    },
    onError: ({ requestId, url, method, error }) => {
      bl.put(
        'bl:///plumb/send',
        { source: `bl:///fetch/${requestId}`, port: 'fetch-errors' },
        {
          headers: { type: 'bl:///types/fetch-error' },
          body: { requestId, url, method, error },
        }
      )
    },
  })

  fetchService.install(bl)
  bl._fetch = fetchService

  console.log('Fetch installed')
}
