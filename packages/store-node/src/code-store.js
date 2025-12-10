import { routes } from '@bassline/core'

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
  const store = new Map();

  return routes(prefix, r => {
    // List loaded modules
    r.get('/', () => {
      const entries = Array.from(store.keys()).map(name => ({
        name,
        type: 'module',
        uri: `bl://${prefix}/${name}`
      }))

      return {
        headers: { type: 'directory' },
        body: { entries }
      }
    })

    r.route('/:module', {
        get: async ({params}) => {
            const mod = store.get(params.module);
            if (mod) {
                return {
                    headers: {
                        type: "js/module"
                    },
                    body: mod
                }
            }
        },
        put: async ({params, body}) => {
            const mod = await import(body.path);
            if(mod) {
                store.set(params.module, mod);
                return {
                    headers: {status: "ok"},
                    body: {}
                }
            } else {
                return {
                    headers: {
                        status: 'err',
                    },
                    body: {}
                }
            }
        }
    })
  })
}