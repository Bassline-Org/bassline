/**
 * Handler Routes
 *
 * REST-like routes for managing handlers as resources.
 *
 * - GET  /handlers           → list all handlers
 * - GET  /handlers/:name     → get handler info
 * - GET  /handlers/:name/definition → get handler definition
 * - PUT  /handlers/:name     → create/update custom handler
 * - PUT  /handlers/:name/delete → delete custom handler
 */

import { routes } from '@bassline/core'

/**
 * Create handler routes.
 *
 * @param {object} options - Configuration
 * @param {object} options.registry - Handler registry
 * @param {function} options.compile - Compiler function
 * @returns {object} Routes object
 */
export function createHandlerRoutes(options) {
  const { registry, compile } = options

  return routes('/handlers', r => {
    // List all handlers (built-in + custom)
    r.get('/', () => {
      const allNames = registry.listAll()

      return {
        headers: { type: 'bl:///types/directory' },
        body: {
          entries: allNames.map(name => ({
            name,
            type: 'handler',
            uri: `bl:///handlers/${name}`,
            builtin: registry.isBuiltin(name)
          }))
        }
      }
    })

    // Get handler info
    r.get('/:name', ({ params }) => {
      const { name } = params

      if (!registry.has(name)) return null

      const custom = registry.getCustom(name)

      return {
        headers: { type: 'bl:///types/handler' },
        body: {
          name,
          builtin: registry.isBuiltin(name),
          description: custom?.description || '',
          createdAt: custom?.createdAt || null,
          entries: [
            { name: 'definition', uri: `bl:///handlers/${name}/definition` }
          ]
        }
      }
    })

    // Get handler definition
    r.get('/:name/definition', ({ params }) => {
      const { name } = params

      if (!registry.has(name)) return null

      const custom = registry.getCustom(name)

      if (custom) {
        return {
          headers: { type: 'bl:///types/handler-definition' },
          body: {
            type: 'composed',
            definition: custom.definition
          }
        }
      }

      return {
        headers: { type: 'bl:///types/handler-definition' },
        body: {
          type: 'builtin'
        }
      }
    })

    // Create/update custom handler
    r.put('/:name', ({ params, body }) => {
      const { name } = params

      if (!body?.definition) {
        return {
          headers: { type: 'bl:///types/error' },
          body: { error: 'Missing required field: definition' }
        }
      }

      try {
        const handler = registry.registerCustom(name, body.definition, body.description)

        return {
          headers: { type: 'bl:///types/handler' },
          body: {
            name,
            builtin: false,
            description: handler.description,
            createdAt: handler.createdAt
          }
        }
      } catch (err) {
        return {
          headers: { type: 'bl:///types/error' },
          body: { error: err.message }
        }
      }
    })

    // Delete custom handler
    r.put('/:name/delete', ({ params }) => {
      const { name } = params
      const existed = registry.deleteCustom(name)

      if (!existed) return null

      return {
        headers: { type: 'bl:///types/resource-removed' },
        body: { uri: `bl:///handlers/${name}` }
      }
    })
  })
}
