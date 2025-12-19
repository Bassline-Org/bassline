import { resource, routes, bind } from './resource.js'

/**
 * Create a fetch resource for HTTP requests
 *
 * Fetch dispatches responses via kit to /response or /error (semantic paths).
 * The kit maps these to wherever responses should go.
 *
 * Routes:
 *   GET  /           → bassline describing fetch
 *   PUT  /request    → make HTTP request { url, method, headers, body }
 *   GET  /:id        → get result of a previous request
 */
export const createFetch = () => {
  const requests = new Map()
  let requestId = 0

  return routes({
    '': resource({
      get: async () => ({
        headers: { type: '/types/bassline' },
        body: {
          name: 'fetch',
          description: 'HTTP request dispatch',
          resources: {
            '/request': { description: 'Make HTTP request' }
          }
        }
      })
    }),

    request: resource({
      put: async (h, body) => {
        const id = `req-${++requestId}`
        const kit = h.kit

        // Fire and forget - do the fetch async
        fetch(body.url, {
          method: body.method || 'GET',
          headers: body.headers,
          body: body.body ? JSON.stringify(body.body) : undefined
        })
          .then(async (res) => {
            let responseBody
            const contentType = res.headers.get('content-type') || ''
            if (contentType.includes('application/json')) {
              responseBody = await res.json()
            } else {
              responseBody = await res.text()
            }

            const result = {
              requestId: id,
              url: body.url,
              status: res.status,
              headers: Object.fromEntries(res.headers.entries()),
              body: responseBody
            }

            requests.set(id, result)

            // Dispatch response via kit (semantic path)
            if (kit) {
              await kit.put({ path: '/response' }, result)
            }
          })
          .catch(async (err) => {
            const result = {
              requestId: id,
              url: body.url,
              error: err.message
            }

            requests.set(id, result)

            // Dispatch error via kit (semantic path)
            if (kit) {
              await kit.put({ path: '/error' }, result)
            }
          })

        return { headers: {}, body: { requestId: id } }
      }
    }),

    unknown: bind('id', resource({
      get: async (h) => {
        const req = requests.get(h.params.id)
        if (!req) return { headers: { condition: 'not-found' }, body: null }
        return { headers: {}, body: req }
      }
    }))
  })
}

export default createFetch
