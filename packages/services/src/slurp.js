import { resource } from '@bassline/core'

/**
 * Parse content based on type hint
 * @param text
 * @param type
 */
function parseContent(text, type) {
  if (!type || type === 'text') return text
  if (type === 'json') {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

/**
 * Serialize content based on type hint
 * If body is an object/array, serialize as JSON regardless of type
 * @param body
 * @param type
 */
function serializeContent(body, type) {
  // Objects/arrays always serialize as JSON
  if (body !== null && typeof body === 'object') {
    return JSON.stringify(body, null, 2)
  }
  if (!type || type === 'text') return String(body)
  if (type === 'json') return JSON.stringify(body)
  return String(body)
}

/**
 * Create slurp resource - universal fetcher
 *
 * Usage:
 *   GET {path: "/slurp", uri: "https://example.com/api", type: "json"}
 *   GET {path: "/slurp", uri: "file:///path/to/file.txt", type: "text"}
 */
export function createSlurp() {
  return resource({
    get: async h => {
      const { uri, type } = h
      if (!uri) {
        return {
          headers: { condition: 'error' },
          body: 'slurp: uri header required',
        }
      }

      try {
        const url = new URL(uri)
        const scheme = url.protocol.replace(':', '')

        switch (scheme) {
          case 'http':
          case 'https': {
            const response = await fetch(uri, {
              method: 'GET',
              headers: h.headers || {},
            })
            const text = await response.text()
            return {
              headers: {
                status: response.status,
                contentType: response.headers.get('content-type'),
                type: type || 'text',
              },
              body: parseContent(text, type),
            }
          }

          case 'file': {
            const { readFile } = await import('node:fs/promises')
            const path = url.pathname
            const text = await readFile(path, 'utf-8')
            return {
              headers: { type: type || 'text' },
              body: parseContent(text, type),
            }
          }

          default:
            return {
              headers: { condition: 'error' },
              body: `slurp: unsupported scheme "${scheme}"`,
            }
        }
      } catch (err) {
        return {
          headers: { condition: 'error' },
          body: `slurp: ${err.message}`,
        }
      }
    },
  })
}

/**
 * Create barf resource - universal writer
 *
 * Usage:
 *   PUT {path: "/barf", uri: "https://example.com/api", type: "json"} body
 *   PUT {path: "/barf", uri: "file:///path/to/file.txt", type: "text"} body
 */
export function createBarf() {
  return resource({
    put: async (h, body) => {
      const { uri, type, method = 'POST' } = h
      if (!uri) {
        return {
          headers: { condition: 'error' },
          body: 'barf: uri header required',
        }
      }

      try {
        const url = new URL(uri)
        const scheme = url.protocol.replace(':', '')

        switch (scheme) {
          case 'http':
          case 'https': {
            const isObject = body !== null && typeof body === 'object'
            const contentType = isObject || type === 'json' ? 'application/json' : 'text/plain'
            const response = await fetch(uri, {
              method: method.toUpperCase(),
              headers: {
                'Content-Type': contentType,
                ...(h.headers || {}),
              },
              body: serializeContent(body, type),
            })
            const text = await response.text()
            return {
              headers: {
                status: response.status,
                contentType: response.headers.get('content-type'),
              },
              body: parseContent(text, type),
            }
          }

          case 'file': {
            const { writeFile } = await import('node:fs/promises')
            const path = url.pathname
            await writeFile(path, serializeContent(body, type), 'utf-8')
            return {
              headers: { type: 'text' },
              body: `wrote ${path}`,
            }
          }

          default:
            return {
              headers: { condition: 'error' },
              body: `barf: unsupported scheme "${scheme}"`,
            }
        }
      } catch (err) {
        return {
          headers: { condition: 'error' },
          body: `barf: ${err.message}`,
        }
      }
    },
  })
}

export default { createSlurp, createBarf }
