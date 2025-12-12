/**
 * Function Routes
 *
 * REST-like routes for managing functions as resources.
 *
 * - GET  /fn           → list all functions
 * - GET  /fn/:name     → get function info
 * - GET  /fn/:name/definition → get function definition
 * - PUT  /fn/:name     → create/update custom function
 * - PUT  /fn/:name/delete → delete custom function
 */

import { resource } from '@bassline/core'

/**
 * Create function routes.
 * @param {object} options - Configuration
 * @param {object} options.registry - Function registry
 * @param {Function} options.compile - Compiler function
 * @returns {object} Routes object with install method
 */
export function createFnRoutes(options) {
  const { registry } = options

  const fnResource = resource((r) => {
    // List all functions (built-in + custom)
    r.get('/', () => {
      const allUris = registry.listAll()

      return {
        headers: { type: 'bl:///types/directory' },
        body: {
          entries: allUris.map((uri) => {
            // Extract name from URI (e.g., 'bl:///fn/sum' → 'sum')
            const name = uri.replace(/^bl:\/\/\/fn\//, '')
            return {
              name,
              type: 'fn',
              uri,
              builtin: registry.isBuiltin(uri),
            }
          }),
        },
      }
    })

    // Get function info
    r.get('/:name', ({ params }) => {
      const { name } = params
      const uri = `bl:///fn/${name}`

      if (!registry.has(uri)) return null

      const custom = registry.getCustom(uri)

      return {
        headers: { type: 'bl:///types/fn' },
        body: {
          name,
          uri,
          builtin: registry.isBuiltin(uri),
          description: custom?.description || '',
          createdAt: custom?.createdAt || null,
          entries: [{ name: 'definition', uri: `${uri}/definition` }],
        },
      }
    })

    // Get function definition
    r.get('/:name/definition', ({ params }) => {
      const { name } = params
      const uri = `bl:///fn/${name}`

      if (!registry.has(uri)) return null

      const custom = registry.getCustom(uri)

      if (custom) {
        return {
          headers: { type: 'bl:///types/fn-definition' },
          body: {
            type: 'composed',
            definition: custom.definition,
          },
        }
      }

      return {
        headers: { type: 'bl:///types/fn-definition' },
        body: {
          type: 'builtin',
        },
      }
    })

    // Create/update custom function
    r.put('/:name', ({ params, body }) => {
      const { name } = params
      const uri = `bl:///fn/${name}`

      if (!body?.definition) {
        return {
          headers: { type: 'bl:///types/error' },
          body: { error: 'Missing required field: definition' },
        }
      }

      try {
        const fn = registry.registerCustom(uri, body.definition, body.description)

        return {
          headers: { type: 'bl:///types/fn' },
          body: {
            name,
            uri,
            builtin: false,
            description: fn.description,
            createdAt: fn.createdAt,
          },
        }
      } catch (err) {
        return {
          headers: { type: 'bl:///types/error' },
          body: { error: err.message },
        }
      }
    })

    // Delete custom function
    r.put('/:name/delete', ({ params }) => {
      const { name } = params
      const uri = `bl:///fn/${name}`
      const existed = registry.deleteCustom(uri)

      if (!existed) return null

      return {
        headers: { type: 'bl:///types/resource-removed' },
        body: { uri },
      }
    })
  })

  /**
   * Install function routes into a Bassline instance
   * @param {import('@bassline/core').Bassline} bl
   * @param {object} [options] - Options
   * @param {string} [options.prefix] - Mount prefix
   */
  fnResource.install = (bl, { prefix = '/fn' } = {}) => {
    bl.mount(prefix, fnResource)
  }

  return fnResource
}

// Keep old name as alias for backward compatibility during migration
export const createHandlerRoutes = createFnRoutes
