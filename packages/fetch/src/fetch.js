import { resource } from '@bassline/core'

/**
 * Create fetch routes for HTTP requests with async response dispatch.
 *
 * Fetch dispatches response/error events through the plumber.
 * Optionally can write responses directly to a cell.
 *
 * Resource structure:
 * - GET  /fetch           → list recent requests
 * - GET  /fetch/:id       → get request status/result
 * - PUT  /fetch/request   → initiate a new fetch
 *
 * @param {object} options - Configuration options
 * @param {function} options.onResponse - Callback when fetch succeeds
 * @param {function} options.onError - Callback when fetch fails
 * @param {import('@bassline/core').Bassline} [options.bl] - Bassline instance for responseCell
 * @returns {object} Fetch routes and management functions
 */
export function createFetchRoutes(options = {}) {
  const { onResponse, onError, bl } = options

  /**
   * Request store - tracks recent requests
   * @type {Map<string, {url: string, method: string, status: string, startTime: string, endTime?: string, response?: any, error?: string}>}
   */
  const store = new Map()

  const MAX_HISTORY = 100

  /**
   * Generate a unique request ID
   */
  function generateId() {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * Trim store to max size
   */
  function trimStore() {
    if (store.size > MAX_HISTORY) {
      const oldest = [...store.keys()].slice(0, store.size - MAX_HISTORY)
      for (const id of oldest) {
        store.delete(id)
      }
    }
  }

  /**
   * Execute a fetch request
   * @param {object} config - Request config
   * @returns {Promise<string>} Request ID
   */
  async function doFetch(config) {
    const { url, method = 'GET', headers = {}, body, responseCell } = config
    const requestId = generateId()

    // Record request start
    store.set(requestId, {
      url,
      method,
      status: 'pending',
      startTime: new Date().toISOString(),
      responseCell,
    })
    trimStore()

    // Execute fetch asynchronously
    ;(async () => {
      try {
        const fetchOptions = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
        }

        if (body && method !== 'GET' && method !== 'HEAD') {
          fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
        }

        const response = await fetch(url, fetchOptions)
        const responseHeaders = Object.fromEntries(response.headers.entries())

        let responseBody
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          responseBody = await response.json()
        } else {
          responseBody = await response.text()
        }

        // Update store
        const record = store.get(requestId)
        if (record) {
          record.status = response.ok ? 'success' : 'error'
          record.endTime = new Date().toISOString()
          record.response = {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body: responseBody,
          }
        }

        // Write to cell if specified
        if (responseCell && bl) {
          await bl.put(responseCell, {}, responseBody)
        }

        // Dispatch response
        if (onResponse) {
          onResponse({
            requestId,
            url,
            method,
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body: responseBody,
            responseCell,
          })
        }
      } catch (err) {
        // Update store
        const record = store.get(requestId)
        if (record) {
          record.status = 'error'
          record.endTime = new Date().toISOString()
          record.error = err.message
        }

        // Dispatch error
        if (onError) {
          onError({
            requestId,
            url,
            method,
            error: err.message,
          })
        }
      }
    })()

    return requestId
  }

  /**
   * Get request by ID
   * @param {string} id - Request ID
   * @returns {object|null} Request record
   */
  function getRequest(id) {
    return store.get(id) || null
  }

  /**
   * List all requests
   * @returns {string[]} Request IDs (newest first)
   */
  function listRequests() {
    return [...store.keys()].reverse()
  }

  const fetchResource = resource((r) => {
    // List recent requests
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: listRequests().map((id) => {
          const req = store.get(id)
          return {
            name: id,
            type: 'fetch-request',
            uri: `bl:///fetch/${id}`,
            status: req?.status,
            url: req?.url,
          }
        }),
      },
    }))

    // Get request by ID
    r.get('/:id', ({ params }) => {
      const req = getRequest(params.id)
      if (!req) return null

      return {
        headers: { type: 'bl:///types/fetch-request' },
        body: {
          id: params.id,
          ...req,
        },
      }
    })

    // Initiate a new fetch
    r.put('/request', async ({ body }) => {
      if (!body?.url) {
        return {
          headers: { type: 'bl:///types/error' },
          body: { error: 'url is required' },
        }
      }

      const requestId = await doFetch(body)

      return {
        headers: { type: 'bl:///types/fetch-request' },
        body: {
          id: requestId,
          url: body.url,
          method: body.method || 'GET',
          status: 'pending',
          message: 'Request initiated. Response will be dispatched through plumber.',
        },
      }
    })
  })

  /**
   * Install fetch routes into a Bassline instance
   * @param {import('@bassline/core').Bassline} bl
   * @param {object} [options] - Options
   * @param {string} [options.prefix='/fetch'] - Mount prefix
   */
  function install(bl, { prefix = '/fetch' } = {}) {
    bl.mount(prefix, fetchResource)
  }

  return {
    routes: fetchResource,
    install,
    doFetch,
    getRequest,
    listRequests,
    _store: store,
  }
}
