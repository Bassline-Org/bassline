import { resource } from './router.js'

/**
 * Create install routes for dynamic module loading.
 *
 * Modules follow a convention: export a default function that receives
 * the Bassline instance and optional config:
 *
 * ```javascript
 * // my-module.js
 * export default function upgradeBassline(bl, body) {
 *   bl.route('/my-feature', { get: () => ({ body: 'hello' }) })
 * }
 * ```
 *
 * Resource structure:
 * - GET  /install           → list installed modules
 * - GET  /install/:name     → get module info
 * - PUT  /install/:name     → install module { path: './module.js', ...config }
 *
 * @param {object} [options] - Configuration
 * @param {string} [options.baseDir] - Base directory for relative paths
 * @returns {object} Install routes and control functions
 */
export function createInstallRoutes(options = {}) {
  const { baseDir = process.cwd() } = options

  /** @type {Map<string, {path: string, installedAt: string, config: object}>} */
  const installed = new Map()

  /**
   * List all installed modules
   * @returns {string[]}
   */
  function listModules() {
    return [...installed.keys()]
  }

  /**
   * Get module info
   * @param {string} name
   * @returns {object|null}
   */
  function getModule(name) {
    return installed.get(name) || null
  }

  const installResource = resource((r) => {
    // List installed modules
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: [...installed.entries()].map(([name, info]) => ({
          name,
          type: 'module',
          uri: `bl:///install/${name}`,
          path: info.path,
          installedAt: info.installedAt,
        })),
      },
    }))

    // Get module info
    r.get('/:name', ({ params }) => {
      const info = installed.get(params.name)
      if (!info) return null
      return {
        headers: { type: 'bl:///types/module' },
        body: info,
      }
    })

    // Install a module
    r.put('/:name', async ({ params, body, bl }) => {
      const { path, ...config } = body

      if (!path) {
        throw new Error('Module path is required')
      }

      // Resolve path - absolute or relative to baseDir
      const fullPath = path.startsWith('/') ? path : `${baseDir}/${path}`

      // Dynamic import
      const module = await import(fullPath)
      const upgrade = module.default

      if (typeof upgrade !== 'function') {
        throw new Error(`Module ${params.name} must export a default function`)
      }

      // Call the upgrade function with bl and config
      await upgrade(bl, config)

      // Track installation
      const info = {
        path,
        installedAt: new Date().toISOString(),
        config: Object.keys(config).length > 0 ? config : undefined,
      }
      installed.set(params.name, info)

      return {
        headers: { type: 'bl:///types/module' },
        body: info,
      }
    })
  })

  /**
   * Install routes into a Bassline instance
   * @param {import('./bassline.js').Bassline} bl
   * @param {object} [options] - Options
   * @param {string} [options.prefix='/install'] - Mount prefix
   */
  function install(bl, { prefix = '/install' } = {}) {
    bl.mount(prefix, installResource)
  }

  return {
    routes: installResource,
    install,
    listModules,
    getModule,
    _installed: installed,
  }
}
