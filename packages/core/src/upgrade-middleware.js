import { resource } from './router.js'

/**
 * Create middleware introspection resource
 * @param {import('./bassline.js').Bassline} bl - Bassline instance to introspect
 */
function createMiddlewareResource(bl) {
  return resource((r) => {
    // List all middleware
    r.get('/', () => ({
      headers: { type: 'bl:///types/list' },
      body: {
        entries: bl.middleware.map((m) => ({
          id: m.id || null,
          priority: m.priority,
        })),
      },
    }))

    // Get middleware by id
    r.get('/:id', ({ params }) => {
      const entry = bl.middleware.find((m) => m.id === params.id)
      if (!entry) return null
      return {
        headers: { type: 'bl:///types/middleware' },
        body: {
          id: entry.id,
          priority: entry.priority,
        },
      }
    })
  })
}

/**
 * Install middleware introspection routes
 * Exposes routes to list and inspect registered middleware
 *
 * @param {import('./bassline.js').Bassline} bl - Bassline instance
 * @param {object} [options] - Options
 * @param {string} [options.prefix='/middleware'] - Mount prefix
 */
export default function installMiddleware(bl, { prefix = '/middleware' } = {}) {
  bl.mount(prefix, createMiddlewareResource(bl))
}
