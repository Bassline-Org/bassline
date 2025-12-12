/**
 * Widget Instance Routes
 *
 * Manages widget instances as resources at bl:///ui/*
 *
 * Each instance has:
 * - GET  /ui/:path*           → get instance
 * - PUT  /ui/:path*           → create/update instance
 * - GET  /ui/:path* /state    → get instance state
 * - PUT  /ui/:path* /state    → update instance state
 * - GET  /ui/:path* /props    → get instance props
 * - PUT  /ui/:path* /ctl      → send control command
 * - PUT  /ui/:path* /delete   → delete instance
 *
 * The root instance at bl:///ui/root is special - it defines
 * what the RootRenderer displays.
 */

import { resource } from '@bassline/core'

/**
 * Create UI instance routes.
 * @param {object} options - Configuration
 * @param {object} [options.bl] - Bassline instance (for plumber dispatch)
 * @returns {object} Routes and control functions
 */
export function createUIRoutes(options = {}) {
  const { bl } = options

  /**
   * Instance store
   * @type {Map<string, {definition: any, widget: string, widgetConfig: object, state: object, props: object, createdAt: string, updatedAt: string}>}
   */
  const instances = new Map()

  /**
   * Parse a path to get instance name and sub-resource
   * @param {string} path - Full path (e.g., 'app/sidebar/state')
   * @returns {{name: string, subResource: string | null}}
   */
  function parsePath(path) {
    // Check for known sub-resources at the end
    const subResources = ['/state', '/props', '/ctl', '/delete', '/children']
    for (const sub of subResources) {
      if (path.endsWith(sub)) {
        return {
          name: path.slice(0, -sub.length),
          subResource: sub.slice(1), // Remove leading /
        }
      }
    }
    return { name: path, subResource: null }
  }

  /**
   * Get an instance by name
   * @param {string} name - Instance name
   * @returns {object | null}
   */
  function getInstance(name) {
    return instances.get(name) || null
  }

  /**
   * Create or update an instance
   * @param {string} name - Instance name
   * @param {object} config - Instance configuration
   * @returns {object} The instance
   */
  function setInstance(name, config) {
    const existing = instances.get(name)
    const now = new Date().toISOString()

    const instance = {
      name,
      definition: config.definition ?? existing?.definition,
      widget: config.widget ?? existing?.widget,
      widgetConfig: config.widgetConfig ?? existing?.widgetConfig ?? {},
      state: config.state ?? existing?.state ?? {},
      props: config.props ?? existing?.props ?? {},
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    }

    instances.set(name, instance)

    // Dispatch instance update via plumber
    if (bl) {
      bl.plumb(`bl:///ui/${name}`, 'ui-instance-updated', {
        headers: { type: 'bl:///types/ui-instance-updated' },
        body: { name, instance },
      })
    }

    return instance
  }

  /**
   * Update instance state
   * @param {string} name - Instance name
   * @param {object} state - State to merge
   * @returns {object | null} Updated instance or null if not found
   */
  function updateState(name, state) {
    const instance = instances.get(name)
    if (!instance) return null

    instance.state = { ...instance.state, ...state }
    instance.updatedAt = new Date().toISOString()

    // Dispatch state change via plumber
    if (bl) {
      bl.plumb(`bl:///ui/${name}`, 'ui-state-changed', {
        headers: { type: 'bl:///types/ui-state-changed' },
        body: { name, state: instance.state },
      })
    }

    return instance
  }

  /**
   * Delete an instance
   * @param {string} name - Instance name
   * @returns {boolean} Whether the instance existed
   */
  function deleteInstance(name) {
    const existed = instances.delete(name)

    if (existed && bl) {
      bl.plumb(`bl:///ui/${name}`, 'ui-instance-deleted', {
        headers: { type: 'bl:///types/ui-instance-deleted' },
        body: { name },
      })
    }

    return existed
  }

  /**
   * List all instance names
   * @returns {string[]}
   */
  function listInstances() {
    return [...instances.keys()]
  }

  /**
   * Handle control commands
   * @param {string} name - Instance name
   * @param {object} command - Command object
   * @returns {object} Result
   */
  function handleControl(name, command) {
    const instance = instances.get(name)
    if (!instance) {
      return { success: false, error: 'Instance not found' }
    }

    const { command: cmd, ...params } = command

    switch (cmd) {
      case 'reset':
        // Reset state to empty
        instance.state = {}
        instance.updatedAt = new Date().toISOString()
        return { success: true, command: 'reset' }

      case 'setState':
        // Set specific state keys
        instance.state = { ...instance.state, ...params }
        instance.updatedAt = new Date().toISOString()
        return { success: true, command: 'setState', state: instance.state }

      case 'focus':
      case 'blur':
      case 'scrollIntoView':
        // These are UI commands - dispatch to plumber for the renderer to handle
        if (bl) {
          bl.plumb(`bl:///ui/${name}`, 'ui-control', {
            headers: { type: 'bl:///types/ui-control' },
            body: { name, command: cmd, params },
          })
        }
        return { success: true, command: cmd, dispatched: true }

      default:
        return { success: false, error: `Unknown command: ${cmd}` }
    }
  }

  const uiResource = resource((r) => {
    // List all instances
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: listInstances().map((name) => {
          const instance = instances.get(name)
          return {
            name,
            type: 'ui-instance',
            uri: `bl:///ui/${name}`,
            widget: instance?.widget,
            updatedAt: instance?.updatedAt,
          }
        }),
      },
    }))

    // Get/create/update instance or sub-resource
    r.get('/:path*', ({ params }) => {
      const { name, subResource } = parsePath(params.path)

      const instance = getInstance(name)
      if (!instance) return null

      // Handle sub-resources
      if (subResource === 'state') {
        return {
          headers: { type: 'bl:///types/ui-state' },
          body: instance.state,
        }
      }

      if (subResource === 'props') {
        return {
          headers: { type: 'bl:///types/ui-props' },
          body: instance.props,
        }
      }

      if (subResource === 'children') {
        // List child instances (instances that start with this path)
        const prefix = name + '/'
        const children = listInstances()
          .filter((n) => n.startsWith(prefix) && !n.slice(prefix.length).includes('/'))
          .map((n) => ({
            name: n.slice(prefix.length),
            uri: `bl:///ui/${n}`,
          }))

        return {
          headers: { type: 'bl:///types/directory' },
          body: { entries: children },
        }
      }

      // Return full instance
      return {
        headers: { type: 'bl:///types/widget-instance' },
        body: {
          name: instance.name,
          definition: instance.definition,
          widget: instance.widget,
          widgetConfig: instance.widgetConfig,
          state: instance.state,
          props: instance.props,
          createdAt: instance.createdAt,
          updatedAt: instance.updatedAt,
          entries: [
            { name: 'state', uri: `bl:///ui/${name}/state` },
            { name: 'props', uri: `bl:///ui/${name}/props` },
            { name: 'ctl', uri: `bl:///ui/${name}/ctl` },
            { name: 'children', uri: `bl:///ui/${name}/children` },
          ],
        },
      }
    })

    // Create/update instance or sub-resource
    r.put('/:path*', ({ params, body }) => {
      const { name, subResource } = parsePath(params.path)

      // Handle sub-resources
      if (subResource === 'state') {
        const instance = updateState(name, body)
        if (!instance) {
          // Auto-create instance if it doesn't exist
          setInstance(name, { state: body })
          return {
            headers: { type: 'bl:///types/ui-state', created: true },
            body,
          }
        }
        return {
          headers: { type: 'bl:///types/ui-state', changed: true },
          body: instance.state,
        }
      }

      if (subResource === 'ctl') {
        const result = handleControl(name, body)
        return {
          headers: { type: 'bl:///types/ui-control-result' },
          body: result,
        }
      }

      if (subResource === 'delete') {
        const existed = deleteInstance(name)
        if (!existed) return null
        return {
          headers: { type: 'bl:///types/resource-removed' },
          body: { uri: `bl:///ui/${name}` },
        }
      }

      // Create/update full instance
      const instance = setInstance(name, body)
      return {
        headers: { type: 'bl:///types/widget-instance' },
        body: {
          name: instance.name,
          definition: instance.definition,
          widget: instance.widget,
          widgetConfig: instance.widgetConfig,
          createdAt: instance.createdAt,
          updatedAt: instance.updatedAt,
        },
      }
    })
  })

  /**
   * Install UI routes into a Bassline instance
   * @param {object} blInstance - Bassline instance
   * @param {object} [opts] - Options
   * @param {string} [opts.prefix] - Mount prefix
   */
  function install(blInstance, { prefix = '/ui' } = {}) {
    blInstance.mount(prefix, uiResource)
  }

  return {
    routes: uiResource,
    install,
    getInstance,
    setInstance,
    updateState,
    deleteInstance,
    listInstances,
    handleControl,
    _instances: instances,
  }
}
