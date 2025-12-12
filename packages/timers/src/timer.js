import { resource } from '@bassline/core'

/**
 * Create timer routes for time-based event dispatch.
 *
 * Timers dispatch messages through the plumber on each tick.
 * They can be started/stopped and configured with interval.
 *
 * Resource structure:
 * - GET  /timers           → list all timers
 * - GET  /timers/:name     → get timer config & status
 * - PUT  /timers/:name     → create/configure timer
 * - PUT  /timers/:name/start → start timer
 * - PUT  /timers/:name/stop  → stop timer
 * - PUT  /timers/:name/kill  → remove timer
 *
 * @param {object} options - Configuration options
 * @param {function} options.onTick - Callback when timer ticks (for plumber dispatch)
 * @returns {object} Timer routes and management functions
 */
export function createTimerRoutes(options = {}) {
  const { onTick } = options

  /**
   * Timer store
   * @type {Map<string, {interval: number, enabled: boolean, intervalId: number|null, tickCount: number}>}
   */
  const store = new Map()

  /**
   * Create or update a timer configuration
   * @param {string} name - Timer name
   * @param {object} config - Timer config
   * @returns {object} Timer state
   */
  function createTimer(name, config) {
    const existing = store.get(name)

    // Stop existing timer if running
    if (existing?.intervalId) {
      clearInterval(existing.intervalId)
    }

    const timer = {
      interval: config.interval ?? existing?.interval ?? 1000,
      enabled: config.enabled ?? existing?.enabled ?? false,
      intervalId: null,
      tickCount: existing?.tickCount ?? 0
    }

    store.set(name, timer)

    // Auto-start if enabled
    if (timer.enabled) {
      startTimer(name)
    }

    return timer
  }

  /**
   * Start a timer
   * @param {string} name - Timer name
   * @returns {object|null} Timer state or null if not found
   */
  function startTimer(name) {
    const timer = store.get(name)
    if (!timer) return null

    // Already running
    if (timer.intervalId) return timer

    timer.enabled = true
    timer.intervalId = setInterval(() => {
      timer.tickCount++
      if (onTick) {
        onTick({
          name,
          tick: timer.tickCount,
          time: new Date().toISOString()
        })
      }
    }, timer.interval)

    return timer
  }

  /**
   * Stop a timer
   * @param {string} name - Timer name
   * @returns {object|null} Timer state or null if not found
   */
  function stopTimer(name) {
    const timer = store.get(name)
    if (!timer) return null

    if (timer.intervalId) {
      clearInterval(timer.intervalId)
      timer.intervalId = null
    }
    timer.enabled = false

    return timer
  }

  /**
   * Kill (remove) a timer
   * @param {string} name - Timer name
   * @returns {boolean} Whether timer existed and was removed
   */
  function killTimer(name) {
    const timer = store.get(name)
    if (!timer) return false

    // Stop if running
    if (timer.intervalId) {
      clearInterval(timer.intervalId)
    }

    store.delete(name)
    return true
  }

  /**
   * Get timer state
   * @param {string} name - Timer name
   * @returns {object|null} Timer state
   */
  function getTimer(name) {
    return store.get(name) || null
  }

  /**
   * List all timers
   * @returns {string[]} Timer names
   */
  function listTimers() {
    return [...store.keys()]
  }

  const timerResource = resource(r => {
    // List all timers
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: listTimers().map(name => {
          const timer = store.get(name)
          return {
            name,
            type: 'timer',
            uri: `bl:///timers/${name}`,
            running: timer?.intervalId != null
          }
        })
      }
    }))

    // Get timer config & status
    r.get('/:name', ({ params }) => {
      const timer = getTimer(params.name)
      if (!timer) return null

      return {
        headers: { type: 'bl:///types/timer' },
        body: {
          name: params.name,
          interval: timer.interval,
          enabled: timer.enabled,
          running: timer.intervalId != null,
          tickCount: timer.tickCount,
          entries: [
            { name: 'start', uri: `bl:///timers/${params.name}/start` },
            { name: 'stop', uri: `bl:///timers/${params.name}/stop` }
          ]
        }
      }
    })

    // Create/configure timer
    r.put('/:name', ({ params, body }) => {
      const timer = createTimer(params.name, body || {})

      return {
        headers: { type: 'bl:///types/timer' },
        body: {
          name: params.name,
          interval: timer.interval,
          enabled: timer.enabled,
          running: timer.intervalId != null,
          tickCount: timer.tickCount
        }
      }
    })

    // Start timer
    r.put('/:name/start', ({ params }) => {
      let timer = getTimer(params.name)

      // Auto-create if doesn't exist
      if (!timer) {
        timer = createTimer(params.name, { enabled: true })
      } else {
        timer = startTimer(params.name)
      }

      return {
        headers: { type: 'bl:///types/timer' },
        body: {
          name: params.name,
          interval: timer.interval,
          enabled: timer.enabled,
          running: timer.intervalId != null,
          tickCount: timer.tickCount
        }
      }
    })

    // Stop timer
    r.put('/:name/stop', ({ params }) => {
      const timer = stopTimer(params.name)
      if (!timer) return null

      return {
        headers: { type: 'bl:///types/timer' },
        body: {
          name: params.name,
          interval: timer.interval,
          enabled: timer.enabled,
          running: false,
          tickCount: timer.tickCount
        }
      }
    })

    // Kill (remove) timer
    r.put('/:name/kill', ({ params }) => {
      const existed = killTimer(params.name)
      if (!existed) return null

      return {
        headers: { type: 'bl:///types/resource-removed' },
        body: { uri: `bl:///timers/${params.name}` }
      }
    })
  })

  /**
   * Install timer routes into a Bassline instance
   * @param {import('@bassline/core').Bassline} bl
   * @param {object} [options] - Options
   * @param {string} [options.prefix='/timers'] - Mount prefix
   */
  function install(bl, { prefix = '/timers' } = {}) {
    bl.mount(prefix, timerResource)
  }

  /**
   * Cleanup all timers (call on shutdown)
   */
  function cleanup() {
    for (const [name] of store) {
      killTimer(name)
    }
  }

  return {
    routes: timerResource,
    install,
    createTimer,
    startTimer,
    stopTimer,
    killTimer,
    getTimer,
    listTimers,
    cleanup,
    _store: store
  }
}
