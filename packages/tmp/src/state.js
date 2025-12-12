/**
 * Ephemeral State Routes
 *
 * Temporary in-memory state that doesn't persist across restarts.
 * Useful for UI state, session data, and transient values.
 *
 * Resource structure:
 * - GET  /tmp/state              → list all state keys
 * - GET  /tmp/state/:name(*)     → get state value (wildcard path)
 * - PUT  /tmp/state/:name(*)     → set state value
 * - PUT  /tmp/state/:name/delete → delete state
 */

import { resource } from '@bassline/core'
import { ports, types } from '@bassline/plumber'

/**
 * Create ephemeral state routes.
 * @param {object} options - Configuration
 * @param {object} options.bl - Bassline instance
 * @returns {object} State routes and control functions
 */
export function createTmpStateRoutes(options = {}) {
  const { bl } = options

  /** @type {Map<string, any>} name → value */
  const store = new Map()

  /**
   * Get state by name
   * @param {string} name - State name (can contain slashes)
   * @returns {any|undefined}
   */
  function getState(name) {
    return store.get(name)
  }

  /**
   * Set state value
   * @param {string} name - State name
   * @param {any} value - Value to set
   * @returns {boolean} True if this is a new key
   */
  function setState(name, value) {
    const isNew = !store.has(name)
    const previousValue = store.get(name)
    store.set(name, value)
    return { isNew, previousValue }
  }

  /**
   * Delete state
   * @param {string} name - State name
   * @returns {boolean} True if the state existed
   */
  function deleteState(name) {
    return store.delete(name)
  }

  /**
   * List all state keys
   * @returns {string[]}
   */
  function listStates() {
    return [...store.keys()]
  }

  const stateResource = resource((r) => {
    // List all state keys
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: listStates().map((name) => ({
          name,
          type: 'tmp-state',
          uri: `bl:///tmp/state/${name}`,
        })),
      },
    }))

    // Get state value
    r.get('/:name*', ({ params }) => {
      const name = params.name
      const value = getState(name)

      if (value === undefined) return null

      return {
        headers: { type: 'bl:///types/tmp-state' },
        body: value,
      }
    })

    // Set state value
    r.put('/:name*', ({ params, body }) => {
      const name = params.name

      // Handle delete endpoint
      if (name.endsWith('/delete')) {
        const actualName = name.slice(0, -7) // Remove '/delete'
        const existed = deleteState(actualName)

        if (!existed) return null

        const source = `bl:///tmp/state/${actualName}`
        bl?.plumb(source, ports.RESOURCE_REMOVED, {
          headers: { type: types.RESOURCE_REMOVED },
          body: { source, name: actualName },
        })

        return {
          headers: { type: 'bl:///types/resource-removed' },
          body: { source },
        }
      }

      const { isNew, previousValue } = setState(name, body)
      const source = `bl:///tmp/state/${name}`

      // Emit change event
      bl?.plumb(source, 'tmp-state-changed', {
        headers: { type: 'bl:///types/tmp-state-changed' },
        body: {
          uri: source,
          name,
          value: body,
          previousValue,
          isNew,
        },
      })

      return {
        headers: {
          type: 'bl:///types/tmp-state',
          changed: !isNew && previousValue !== body,
        },
        body,
      }
    })
  })

  /**
   * Install state routes into a Bassline instance
   * @param {import('@bassline/core').Bassline} blInstance
   * @param {object} [options] - Options
   * @param {string} [options.prefix] - Mount prefix
   */
  function install(blInstance, { prefix = '/tmp/state' } = {}) {
    blInstance.mount(prefix, stateResource)
  }

  return {
    routes: stateResource,
    install,
    getState,
    setState,
    deleteState,
    listStates,
    _store: store,
  }
}
