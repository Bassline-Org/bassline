import { routes } from '@bassline/core'

/**
 * Create service registry routes for service discovery.
 *
 * @returns {object} Service routes and registration functions
 */
export function createServiceRoutes() {
  const services = new Map()  // name -> { info, routes }

  const serviceRoutes = routes('/services', r => {
    // List all registered services
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: [...services.keys()].map(name => ({
          name,
          uri: `bl:///services/${name}`
        }))
      }
    }))
  })

  return {
    routes: serviceRoutes,
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
     */
    install: (bl) => bl.install(serviceRoutes)
  }
}
