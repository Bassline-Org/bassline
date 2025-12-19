import { resource, routes, bind } from '@bassline/core'

/**
 * Create service registry resource
 *
 * Routes:
 *   GET  /           → list all registered services
 *   GET  /:name      → get service info (delegates to registered service)
 *
 * Services are registered as sub-resources at creation time.
 */
export function createServices() {
  const registry = new Map()

  return {
    routes: routes({
      '': resource({
        get: async () => ({
          headers: { type: '/types/service-directory' },
          body: {
            name: 'services',
            description: 'Service registry',
            resources: Object.fromEntries(
              [...registry.keys()].map(name => [`/${name}`, {}])
            )
          }
        })
      }),

      unknown: bind('name', resource({
        get: async (h) => {
          const service = registry.get(h.params.name)
          if (!service) return { headers: { status: 404 }, body: null }
          return service.get({ ...h, path: '/' })
        },

        put: async (h, body) => {
          const service = registry.get(h.params.name)
          if (!service) return { headers: { status: 404 }, body: null }
          return service.put({ ...h, path: '/' }, body)
        }
      }))
    }),

    /**
     * Register a service resource
     * @param {string} name - Service name
     * @param {object} serviceResource - Resource with get/put
     */
    register: (name, serviceResource) => {
      registry.set(name, serviceResource)
    },

    /**
     * Get a registered service
     * @param {string} name - Service name
     */
    get: (name) => registry.get(name),

    /**
     * List all registered service names
     */
    list: () => [...registry.keys()]
  }
}

export default createServices
