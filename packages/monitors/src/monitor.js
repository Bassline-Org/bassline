import { resource } from '@bassline/core'
import { ports, types } from '@bassline/plumber'

/**
 * Create monitor routes that compose Timer + Fetch + Cell.
 *
 * A Monitor automatically polls a URL at a configurable interval
 * and writes the response to a cell. One PUT creates a complete
 * polling pipeline.
 *
 * Resource structure:
 * - GET  /monitors           → list all monitors
 * - GET  /monitors/:name     → get monitor config, status, latest value
 * - PUT  /monitors/:name     → create/configure monitor
 * - PUT  /monitors/:name/start → start monitoring
 * - PUT  /monitors/:name/stop  → stop monitoring
 * - PUT  /monitors/:name/fetch → trigger immediate fetch
 *
 * Monitor config:
 * {
 * url: 'https://api.example.com/status',
 * interval: 60000,        // poll every 60s
 * enabled: true,          // auto-start
 * extract: 'data.value',  // optional: extract nested field
 * method: 'GET',          // HTTP method
 * headers: {},            // custom headers
 * }
 * @param {object} options - Configuration options
 * @param {import('@bassline/core').Bassline} options.bl - Bassline instance
 * @returns {object} Monitor routes and management functions
 */
export function createMonitorRoutes(options = {}) {
  const { bl } = options

  /**
   * Monitor store
   * @type {Map<string, {url: string, interval: number, enabled: boolean, method: string, headers: object, extract?: string, lastFetch?: string, lastValue?: any, lastError?: string, fetchCount: number}>}
   */
  const store = new Map()

  /**
   * Active timer listeners (unsubscribe functions)
   */
  const timerListeners = new Map()

  /**
   * Extract a nested value from an object using dot notation
   * @param {any} obj - Source object
   * @param {string} path - Dot-separated path (e.g., 'data.status.value')
   * @returns {any} Extracted value or undefined
   */
  function extractValue(obj, path) {
    if (!path) return obj
    const parts = path.split('.')
    let current = obj
    for (const part of parts) {
      if (current === null || current === undefined) return undefined
      current = current[part]
    }
    return current
  }

  /**
   * Get the cell URI for a monitor
   * @param {string} name - Monitor name
   * @returns {string} Cell URI
   */
  function getCellUri(name) {
    return `bl:///cells/monitor-${name}`
  }

  /**
   * Get the timer name for a monitor
   * @param {string} name - Monitor name
   * @returns {string} Timer name
   */
  function getTimerName(name) {
    return `monitor-${name}`
  }

  /**
   * Execute a fetch for a monitor
   * @param {string} name - Monitor name
   * @returns {Promise<any>} Fetched value
   */
  async function doMonitorFetch(name) {
    const monitor = store.get(name)
    if (!monitor) return null

    try {
      monitor.lastFetch = new Date().toISOString()
      monitor.fetchCount++

      // Use the fetch module if available, otherwise use native fetch
      const fetchOptions = {
        method: monitor.method,
        headers: {
          Accept: 'application/json',
          ...monitor.headers,
        },
      }

      const response = await fetch(monitor.url, fetchOptions)

      let body
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        body = await response.json()
      } else {
        body = await response.text()
      }

      // Extract nested value if configured
      const value = extractValue(body, monitor.extract)
      monitor.lastValue = value
      monitor.lastError = undefined

      // Write to the monitor's cell
      const cellUri = getCellUri(name)
      await bl.put(cellUri, {}, value)

      // Send update through plumber
      bl?.plumb(`bl:///monitors/${name}`, ports.MONITOR_UPDATES, {
        headers: { type: types.MONITOR_UPDATE },
        body: {
          monitor: name,
          value,
          fetchCount: monitor.fetchCount,
          time: monitor.lastFetch,
        },
      })

      return value
    } catch (err) {
      monitor.lastError = err.message
      monitor.lastValue = undefined

      // Send error through plumber
      bl?.plumb(`bl:///monitors/${name}`, ports.MONITOR_ERRORS, {
        headers: { type: types.MONITOR_ERROR },
        body: {
          monitor: name,
          error: err.message,
          time: new Date().toISOString(),
        },
      })

      return null
    }
  }

  /**
   * Create or update a monitor
   * @param {string} name - Monitor name
   * @param {object} config - Monitor config
   * @returns {Promise<object>} Monitor state
   */
  async function createMonitor(name, config) {
    const isNew = !store.has(name)
    const existing = store.get(name)

    // Stop existing timer listener
    await stopMonitor(name)

    const monitor = {
      url: config.url ?? existing?.url,
      interval: config.interval ?? existing?.interval ?? 60000,
      enabled: config.enabled ?? existing?.enabled ?? false,
      method: config.method ?? existing?.method ?? 'GET',
      headers: config.headers ?? existing?.headers ?? {},
      extract: config.extract ?? existing?.extract,
      lastFetch: existing?.lastFetch,
      lastValue: existing?.lastValue,
      lastError: existing?.lastError,
      fetchCount: existing?.fetchCount ?? 0,
    }

    store.set(name, monitor)

    // Create the backing cell (lww for latest value)
    const cellUri = getCellUri(name)
    await bl.put(cellUri, {}, { lattice: 'lww' }).catch(() => {
      // Cell might already exist, that's ok
    })

    // Emit lifecycle event
    const source = `bl:///monitors/${name}`
    if (isNew) {
      bl?.plumb(source, ports.RESOURCE_CREATED, {
        headers: { type: types.RESOURCE_CREATED },
        body: { source, resourceType: 'monitor', config },
      })
    } else {
      bl?.plumb(source, ports.RESOURCE_UPDATED, {
        headers: { type: types.RESOURCE_UPDATED },
        body: { source, resourceType: 'monitor', changes: config },
      })
    }

    // Auto-start if enabled
    if (monitor.enabled && monitor.url) {
      await startMonitor(name)
    }

    return monitor
  }

  /**
   * Start a monitor (creates timer and sets up plumber rule)
   * @param {string} name - Monitor name
   * @returns {Promise<object|null>} Monitor state
   */
  async function startMonitor(name) {
    const monitor = store.get(name)
    if (!monitor) return null
    if (!monitor.url) return monitor

    // Already running
    if (timerListeners.has(name)) return monitor

    monitor.enabled = true
    const timerName = getTimerName(name)

    // Create/configure the timer
    await bl.put(
      `bl:///timers/${timerName}`,
      {},
      {
        interval: monitor.interval,
        enabled: true,
      }
    )

    // Add plumber rule to route timer ticks to this monitor's on-tick endpoint
    await bl.put(
      `bl:///plumb/rules/monitor-${name}-timer`,
      {},
      {
        match: {
          source: `^bl:///timers/${timerName}`,
          type: 'bl:///types/timer-tick',
        },
        to: `bl:///monitors/${name}/on-tick`,
      }
    )

    // Mark as running
    timerListeners.set(name, true)

    // Emit RESOURCE_ENABLED event
    const source = `bl:///monitors/${name}`
    bl?.plumb(source, ports.RESOURCE_ENABLED, {
      headers: { type: types.RESOURCE_ENABLED },
      body: { source, resourceType: 'monitor' },
    })

    // Do an immediate fetch
    doMonitorFetch(name)

    return monitor
  }

  /**
   * Stop a monitor
   * @param {string} name - Monitor name
   * @returns {Promise<object|null>} Monitor state
   */
  async function stopMonitor(name) {
    const monitor = store.get(name)
    if (!monitor) return null

    // Check if was running (to emit event only on actual state change)
    const wasRunning = timerListeners.has(name)

    monitor.enabled = false
    const timerName = getTimerName(name)

    // Stop the timer
    await bl.put(`bl:///timers/${timerName}/stop`, {}, {})

    // Remove running marker
    timerListeners.delete(name)

    // Emit RESOURCE_DISABLED event only if it was running
    if (wasRunning) {
      const source = `bl:///monitors/${name}`
      bl?.plumb(source, ports.RESOURCE_DISABLED, {
        headers: { type: types.RESOURCE_DISABLED },
        body: { source, resourceType: 'monitor' },
      })
    }

    // Note: We don't remove the plumber rule here - it's harmless if the timer isn't running
    // and will be reused if the monitor restarts. To fully remove, use killMonitor.

    return monitor
  }

  /**
   * Kill (remove) a monitor completely, including all created resources
   * @param {string} name - Monitor name
   * @returns {Promise<boolean>} Whether monitor existed
   */
  async function killMonitor(name) {
    const existed = store.has(name)
    if (!existed) return false

    // Stop the monitor first
    await stopMonitor(name)

    const timerName = getTimerName(name)
    const cellUri = getCellUri(name)

    // Kill all created resources
    await Promise.all([
      bl.put(`bl:///timers/${timerName}/kill`, {}, {}).catch(() => {}),
      bl.put(`${cellUri}/kill`, {}, {}).catch(() => {}),
      bl.put(`bl:///plumb/rules/monitor-${name}-timer/kill`, {}, {}).catch(() => {}),
    ])

    store.delete(name)

    // Notify through plumber
    bl?.plumb(`bl:///monitors/${name}`, ports.RESOURCE_REMOVED, {
      headers: { type: types.RESOURCE_REMOVED },
      body: { source: `bl:///monitors/${name}` },
    })

    return true
  }

  /**
   * Get monitor state
   * @param {string} name - Monitor name
   * @returns {object|null} Monitor state
   */
  function getMonitor(name) {
    return store.get(name) || null
  }

  /**
   * List all monitors
   * @returns {string[]} Monitor names
   */
  function listMonitors() {
    return [...store.keys()]
  }

  const monitorResource = resource((r) => {
    // List all monitors
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: listMonitors().map((name) => {
          const monitor = store.get(name)
          return {
            name,
            type: 'monitor',
            uri: `bl:///monitors/${name}`,
            running: timerListeners.has(name),
            url: monitor?.url,
            lastFetch: monitor?.lastFetch,
          }
        }),
      },
    }))

    // Get monitor config & status
    r.get('/:name', ({ params }) => {
      const monitor = getMonitor(params.name)
      if (!monitor) return null

      return {
        headers: { type: 'bl:///types/monitor' },
        body: {
          name: params.name,
          url: monitor.url,
          interval: monitor.interval,
          enabled: monitor.enabled,
          running: timerListeners.has(params.name),
          method: monitor.method,
          headers: monitor.headers,
          extract: monitor.extract,
          cell: getCellUri(params.name),
          lastFetch: monitor.lastFetch,
          lastValue: monitor.lastValue,
          lastError: monitor.lastError,
          fetchCount: monitor.fetchCount,
          entries: [
            { name: 'start', uri: `bl:///monitors/${params.name}/start` },
            { name: 'stop', uri: `bl:///monitors/${params.name}/stop` },
            { name: 'fetch', uri: `bl:///monitors/${params.name}/fetch` },
          ],
        },
      }
    })

    // Create/configure monitor
    r.put('/:name', async ({ params, body }) => {
      const monitor = await createMonitor(params.name, body || {})

      return {
        headers: { type: 'bl:///types/monitor' },
        body: {
          name: params.name,
          url: monitor.url,
          interval: monitor.interval,
          enabled: monitor.enabled,
          running: timerListeners.has(params.name),
          cell: getCellUri(params.name),
          fetchCount: monitor.fetchCount,
        },
      }
    })

    // Start monitor
    r.put('/:name/start', async ({ params }) => {
      let monitor = getMonitor(params.name)
      if (!monitor) {
        return {
          headers: { type: 'bl:///types/error' },
          body: { error: 'Monitor not found. Create it first with PUT /monitors/:name' },
        }
      }

      monitor = await startMonitor(params.name)

      return {
        headers: { type: 'bl:///types/monitor' },
        body: {
          name: params.name,
          running: timerListeners.has(params.name),
          message: 'Monitor started',
        },
      }
    })

    // Stop monitor
    r.put('/:name/stop', async ({ params }) => {
      const monitor = await stopMonitor(params.name)
      if (!monitor) return null

      return {
        headers: { type: 'bl:///types/monitor' },
        body: {
          name: params.name,
          running: false,
          message: 'Monitor stopped',
        },
      }
    })

    // Trigger immediate fetch
    r.put('/:name/fetch', async ({ params }) => {
      const monitor = getMonitor(params.name)
      if (!monitor) return null

      const value = await doMonitorFetch(params.name)

      return {
        headers: { type: 'bl:///types/monitor-fetch' },
        body: {
          name: params.name,
          value,
          error: monitor.lastError,
          time: monitor.lastFetch,
        },
      }
    })

    // Kill (remove) monitor
    r.put('/:name/kill', async ({ params }) => {
      const existed = await killMonitor(params.name)
      if (!existed) return null

      return {
        headers: { type: 'bl:///types/resource-removed' },
        body: { source: `bl:///monitors/${params.name}` },
      }
    })

    // Handle timer tick from plumber (alternative to listen-based approach)
    // Message format: { source: 'bl:///timers/monitor-foo', type, put: { headers, body } }
    r.put('/:name/on-tick', async ({ params }) => {
      const monitor = getMonitor(params.name)
      if (!monitor) return null

      await doMonitorFetch(params.name)

      return {
        headers: { type: 'bl:///types/monitor-tick-handled' },
        body: { monitor: params.name },
      }
    })
  })

  /**
   * Install monitor routes into a Bassline instance
   * @param {import('@bassline/core').Bassline} bassline
   * @param {object} [options] - Options
   * @param {string} [options.prefix] - Mount prefix
   */
  function install(bassline, { prefix = '/monitors' } = {}) {
    bassline.mount(prefix, monitorResource)
  }

  /**
   * Cleanup all monitors (call on shutdown)
   */
  function cleanup() {
    for (const name of store.keys()) {
      stopMonitor(name)
    }
  }

  return {
    routes: monitorResource,
    install,
    createMonitor,
    startMonitor,
    stopMonitor,
    killMonitor,
    getMonitor,
    listMonitors,
    doMonitorFetch,
    cleanup,
    _store: store,
  }
}
