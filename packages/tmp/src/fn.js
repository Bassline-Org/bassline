/**
 * Temporary Function Routes
 *
 * Temporary functions that don't persist across restarts.
 * These are stored in the main fn registry but marked as temporary.
 *
 * Resource structure:
 * - GET  /tmp/fn           → list all temporary functions
 * - GET  /tmp/fn/:name     → get temporary function info
 * - PUT  /tmp/fn/:name     → create/update temporary function
 * - PUT  /tmp/fn/:name/delete → delete temporary function
 */

import { resource } from '@bassline/core'
import { ports, types } from '@bassline/plumber'

/**
 * Create temporary function routes.
 * @param {object} options - Configuration
 * @param {object} options.bl - Bassline instance
 * @returns {object} Function routes and control functions
 */
export function createTmpFnRoutes(options = {}) {
  const { bl } = options

  /** @type {Set<string>} Track which functions are temporary */
  const tmpFns = new Set()

  /**
   * Register a temporary function
   * @param {string} name - Function name (without prefix)
   * @param {object} config - Function config
   * @param {any} config.definition - Hiccup-style definition
   * @param {string} [config.description] - Function description
   * @returns {Promise<object>} Created function info
   */
  async function registerTmpFn(name, config) {
    const fnModule = await bl.getModule('fn')
    const uri = `bl:///tmp/fn/${name}`

    // Register in the main fn registry
    fnModule.registry.registerCustom(uri, config.definition, config.description)

    tmpFns.add(name)

    return {
      name,
      uri,
      definition: config.definition,
      description: config.description || '',
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * Delete a temporary function
   * @param {string} name - Function name
   * @returns {Promise<boolean>} True if existed and was deleted
   */
  async function deleteTmpFn(name) {
    if (!tmpFns.has(name)) return false

    const fnModule = await bl.getModule('fn')
    const uri = `bl:///tmp/fn/${name}`

    fnModule.registry.deleteCustom(uri)
    tmpFns.delete(name)

    return true
  }

  /**
   * List all temporary function names
   * @returns {string[]}
   */
  function listTmpFns() {
    return [...tmpFns]
  }

  /**
   * Check if a function is temporary
   * @param {string} name - Function name
   * @returns {boolean}
   */
  function isTmpFn(name) {
    return tmpFns.has(name)
  }

  const fnResource = resource((r) => {
    // List all temporary functions
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: listTmpFns().map((name) => ({
          name,
          type: 'tmp-fn',
          uri: `bl:///tmp/fn/${name}`,
        })),
      },
    }))

    // Get temporary function info
    r.get('/:name', async ({ params }) => {
      const { name } = params

      if (!tmpFns.has(name)) return null

      const fnModule = await bl.getModule('fn')
      const uri = `bl:///tmp/fn/${name}`
      const custom = fnModule.registry.getCustom(uri)

      if (!custom) return null

      return {
        headers: { type: 'bl:///types/fn' },
        body: {
          name,
          uri,
          temporary: true,
          definition: custom.definition,
          description: custom.description || '',
          createdAt: custom.createdAt,
        },
      }
    })

    // Delete temporary function
    r.put('/:name/delete', async ({ params }) => {
      const { name } = params
      const existed = await deleteTmpFn(name)

      if (!existed) return null

      const source = `bl:///tmp/fn/${name}`
      bl?.plumb(source, ports.RESOURCE_REMOVED, {
        headers: { type: types.RESOURCE_REMOVED },
        body: { source, name },
      })

      return {
        headers: { type: 'bl:///types/resource-removed' },
        body: { source },
      }
    })

    // Create/update temporary function
    r.put('/:name', async ({ params, body }) => {
      const { name } = params

      if (!body?.definition) {
        return {
          headers: { type: 'bl:///types/error' },
          body: { error: 'Missing required field: definition' },
        }
      }

      const isNew = !tmpFns.has(name)
      const fn = await registerTmpFn(name, body)
      const source = `bl:///tmp/fn/${name}`

      // Emit lifecycle event
      if (isNew) {
        bl?.plumb(source, ports.RESOURCE_CREATED, {
          headers: { type: types.RESOURCE_CREATED },
          body: {
            source,
            resourceType: 'tmp-fn',
            name,
            definition: body.definition,
            description: body.description,
          },
        })
      } else {
        bl?.plumb(source, ports.RESOURCE_UPDATED, {
          headers: { type: types.RESOURCE_UPDATED },
          body: {
            source,
            resourceType: 'tmp-fn',
            name,
            definition: body.definition,
            description: body.description,
          },
        })
      }

      return {
        headers: { type: 'bl:///types/fn' },
        body: fn,
      }
    })
  })

  /**
   * Install temporary function routes into a Bassline instance
   * @param {import('@bassline/core').Bassline} blInstance
   * @param {object} [options] - Options
   * @param {string} [options.prefix] - Mount prefix
   */
  function install(blInstance, { prefix = '/tmp/fn' } = {}) {
    blInstance.mount(prefix, fnResource)
  }

  return {
    routes: fnResource,
    install,
    registerTmpFn,
    deleteTmpFn,
    listTmpFns,
    isTmpFn,
    _tmpFns: tmpFns,
  }
}
