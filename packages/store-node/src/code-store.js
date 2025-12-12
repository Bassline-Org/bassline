import { resource } from '@bassline/core'

/**
 * Create a code store for loading JavaScript modules
 *
 * @param {string} hostDir - Directory containing JS modules
 * @param {string} [defaultPrefix='/code'] - Default mount prefix
 * @returns {object} Resource with routes and install method
 *
 * @example
 * const bl = new Bassline()
 * bl.mount('/code', createCodeStore('./src'))
 *
 * // List available modules
 * bl.get('bl:///code')
 * // → { headers: { type: 'directory' }, body: { entries: [...] } }
 *
 * // Load a module
 * bl.get('bl:///code/my-module')
 * // → { headers: { type: 'module' }, body: { exports: [...] } }
 */
export function createCodeStore(hostDir, defaultPrefix = '/code') {
  const store = new Map()
  let mountedPrefix = defaultPrefix

  const codeResource = resource((r) => {
    // List loaded modules
    r.get('/', () => {
      const entries = Array.from(store.keys()).map((name) => ({
        name,
        type: 'module',
        uri: `bl://${mountedPrefix}/${name}`,
      }))

      return {
        headers: { type: 'directory' },
        body: { entries },
      }
    })

    r.route('/:module', {
      get: async ({ params }) => {
        const mod = store.get(params.module)
        if (mod) {
          return {
            headers: {
              type: 'js/module',
            },
            body: mod,
          }
        }
      },
      put: async ({ params, body }) => {
        const mod = await import(body.path)
        if (mod) {
          store.set(params.module, mod)
          return {
            headers: { status: 'ok' },
            body: {},
          }
        } else {
          return {
            headers: {
              status: 'err',
            },
            body: {},
          }
        }
      },
    })
  })

  /**
   * Install code store routes into a Bassline instance
   * @param {import('@bassline/core').Bassline} bl
   * @param {object} [options] - Options
   * @param {string} [options.prefix] - Mount prefix (defaults to defaultPrefix)
   */
  codeResource.install = (bl, { prefix = defaultPrefix } = {}) => {
    mountedPrefix = prefix
    bl.mount(prefix, codeResource)
  }

  return codeResource
}
