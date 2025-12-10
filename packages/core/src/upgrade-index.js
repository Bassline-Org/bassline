import { routes } from './router.js'

/**
 * Install root index route that lists all available subsystems
 * @param {import('./bassline.js').Bassline} bl - Bassline instance
 */
export default function installIndex(bl) {
  const indexRoutes = routes('/', r => {
    r.get('/', ({ bl }) => {
      // Collect all top-level route patterns
      const subsystems = new Set()

      for (const route of bl.routes) {
        // Skip routes without a pattern (e.g., fallback routes)
        if (!route.pattern) continue

        // Extract the first path segment from each route pattern
        const match = route.pattern.match(/^\/([^/:]+)/)
        if (match) {
          subsystems.add(match[1])
        }
      }

      return {
        headers: { type: 'bl:///types/index' },
        body: {
          name: 'Bassline',
          description: 'Everything is a resource',
          subsystems: [...subsystems].sort().map(name => ({
            name,
            uri: `bl:///${name}`
          }))
        }
      }
    })
  })

  bl.install(indexRoutes)
}
