import { routes } from '@bassline/core'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Create a code store for loading JavaScript modules
 *
 * @param {string} hostDir - Directory containing JS modules
 * @param {string} [prefix='/code'] - URL prefix for these routes
 * @returns {import('@bassline/core').RouterBuilder}
 *
 * @example
 * const bl = new Bassline()
 * bl.install(createCodeStore('./src', '/code'))
 *
 * // List available modules
 * bl.get('bl:///code')
 * // → { headers: { type: 'directory' }, body: { entries: [...] } }
 *
 * // Load a module
 * bl.get('bl:///code/my-module')
 * // → { headers: { type: 'module' }, body: { exports: [...] } }
 */
export function createCodeStore(hostDir, prefix = '/code') {
  return routes(prefix, r => {
    // List available modules
    r.get('/', () => {
      if (!existsSync(hostDir)) {
        return {
          headers: { type: 'directory' },
          body: { entries: [] }
        }
      }

      try {
        const entries = readdirSync(hostDir)
          .filter(name => name.endsWith('.js'))
          .map(name => ({
            name: name.replace(/\.js$/, ''),
            type: 'module',
            uri: `bl://${prefix}/${name.replace(/\.js$/, '')}`
          }))

        return {
          headers: { type: 'directory' },
          body: { entries }
        }
      } catch (err) {
        return {
          headers: { error: 'list-error' },
          body: { message: err.message }
        }
      }
    })

    // Get module info or load module
    r.get('/:module', async ({ params }) => {
      const modulePath = join(hostDir, params.module + '.js')

      if (!existsSync(modulePath)) {
        return null
      }

      try {
        const mod = await import(modulePath)
        const exports = Object.keys(mod)

        return {
          headers: { type: 'module' },
          body: {
            path: modulePath,
            exports
          }
        }
      } catch (err) {
        return {
          headers: { error: 'load-error' },
          body: { message: err.message }
        }
      }
    })
  })
}