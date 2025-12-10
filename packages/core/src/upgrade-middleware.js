import { routes } from './router.js'

/**
 * Install middleware introspection routes
 * Exposes routes to list and inspect registered middleware
 *
 * @param {import('./bassline.js').Bassline} bl - Bassline instance
 */
export default function installMiddleware(bl) {
  const middlewareRoutes = routes('/middleware', r => {
    // List all middleware
    r.get('/', () => ({
      headers: { type: 'bl:///types/list' },
      body: {
        entries: bl.middleware.map(m => ({
          id: m.id || null,
          priority: m.priority
        }))
      }
    }))

    // Get middleware by id
    r.get('/:id', ({ params }) => {
      const entry = bl.middleware.find(m => m.id === params.id)
      if (!entry) return null
      return {
        headers: { type: 'bl:///types/middleware' },
        body: {
          id: entry.id,
          priority: entry.priority
        }
      }
    })
  })

  bl.install(middlewareRoutes)
}
