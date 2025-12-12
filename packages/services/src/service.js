import { resource } from '@bassline/core'

/**
 * Create service registry routes for service discovery.
 *
 * Services register themselves and expose their operations for introspection.
 * GET /services returns all services with their operation summaries.
 *
 * @returns {object} Service routes and registration functions
 */
export function createServiceRoutes() {
  const services = new Map()  // name -> { service, info }
  let _bl = null

  const serviceResource = resource(r => {
    // List all registered services with operation summaries
    r.get('/', async () => {
      const entries = await Promise.all(
        [...services.keys()].map(async name => {
          try {
            // Query each service for its info
            const info = _bl ? await _bl.get(`bl:///services/${name}`) : null
            const body = info?.body || {}

            return {
              name,
              uri: `bl:///services/${name}`,
              description: body.description,
              version: body.version,
              operations: body.operations?.map(op => ({
                name: op.name,
                method: op.method,
                path: op.path,
                description: op.description
              }))
            }
          } catch {
            // Service info not available
            return {
              name,
              uri: `bl:///services/${name}`
            }
          }
        })
      )

      return {
        headers: { type: 'bl:///types/service-directory' },
        body: { entries }
      }
    })
  })

  return {
    routes: serviceResource,
    /**
     * Register a service
     * @param {string} name - Service name
     * @param {object} service - Service object with info and routes
     */
    register: (name, service) => services.set(name, service),
    /**
     * Get a registered service
     * @param {string} name - Service name
     * @returns {object|undefined}
     */
    get: (name) => services.get(name),
    /**
     * List all registered service names
     * @returns {string[]}
     */
    list: () => [...services.keys()],
    /**
     * Install service routes into a Bassline instance
     * @param {import('@bassline/core').Bassline} bl
     * @param {object} [options] - Options
     * @param {string} [options.prefix='/services'] - Mount prefix
     */
    install: (bl, { prefix = '/services' } = {}) => {
      _bl = bl
      bl.mount(prefix, serviceResource)
    }
  }
}
