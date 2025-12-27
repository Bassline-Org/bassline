import { resource } from './resource.js'
import { circuit } from './circuit.js'

/**
 * Create a deployment circuit that wraps an app with management ports.
 *
 * Ports:
 * GET  /state    → { desired, actual, startedAt, ... }
 * PUT  /state    → { desired: 'running'|'stopped' }
 * GET  /info     → { name, version, labels, ... }
 * GET  /health   → { ok, checks, lastCheck }
 * GET  /logs     → array of log entries
 * PUT  /logs     → append log entry
 * GET  /metrics  → { requests, errors, uptime, ... }
 * GET  /config   → configuration object
 * PUT  /config   → update configuration
 * GET  /app/*    → forward to app
 * PUT  /app/*    → forward to app
 * PUT  /tick     → health check tick (from timer)
 * @param {object} app - The app resource to wrap
 * @param {object} spec - Deployment spec { name, version, labels, healthCheck, ... }
 * @returns {object} A circuit with standard deployment ports
 */
export const createDeployment = (app, spec = {}) => {
  // Plain JS state
  const state = { desired: 'stopped', actual: 'stopped' }
  let health = { ok: true, checks: [], lastCheck: null }
  let config = spec.config || {}
  const logs = []
  const metrics = { requests: 0, errors: 0, healthChecks: 0 }
  const maxLogs = spec.maxLogs || 1000

  // Helper to append log
  const appendLog = (level, message, data = {}) => {
    const entry = { time: Date.now(), level, message, ...data }
    logs.push(entry)
    if (logs.length > maxLogs) logs.shift()
    return entry
  }

  // State resource with lifecycle transitions
  const stateResource = resource({
    get: async () => ({ headers: {}, body: state }),
    put: async (h, b) => {
      const prevDesired = state.desired
      const prevActual = state.actual

      if (b.desired && b.desired !== prevDesired) {
        state.desired = b.desired

        if (b.desired === 'running') {
          // Transition: stopped → starting → running
          if (prevActual === 'stopped') {
            state.actual = 'starting'
            appendLog('info', 'Starting deployment')

            // Simulate async startup (in real impl, would actually start app)
            state.actual = 'running'
            state.startedAt = Date.now()
            delete state.stoppedAt
            appendLog('info', 'Deployment started')
          }
        } else if (b.desired === 'stopped') {
          // Transition: running → stopping → stopped
          if (prevActual === 'running' || prevActual === 'starting') {
            state.actual = 'stopping'
            appendLog('info', 'Stopping deployment')

            state.actual = 'stopped'
            state.stoppedAt = Date.now()
            appendLog('info', 'Deployment stopped')
          }
        }
      }

      return { headers: {}, body: state }
    },
  })

  // Info resource (read-only)
  const infoResource = resource({
    get: async () => ({
      headers: {},
      body: {
        name: spec.name || 'unnamed',
        version: spec.version || '0.0.0',
        labels: spec.labels || {},
        ...spec,
        config: undefined, // Don't leak config in info
      },
    }),
  })

  // Health resource
  const healthResource = resource({
    get: async () => ({
      headers: {},
      body: {
        ...health,
        ok: health.ok && state.actual === 'running',
      },
    }),
  })

  // Logs resource
  const logsResource = resource({
    get: async h => {
      const limit = h.limit || 100
      const level = h.level // optional filter
      let result = logs.slice(-limit)
      if (level) {
        result = result.filter(l => l.level === level)
      }
      return { headers: {}, body: result }
    },
    put: async (h, b) => {
      const entry = appendLog(b.level || 'info', b.message, b.data)
      return { headers: {}, body: entry }
    },
  })

  // Metrics resource
  const metricsResource = resource({
    get: async () => ({
      headers: {},
      body: {
        ...metrics,
        uptime: state.startedAt ? Date.now() - state.startedAt : 0,
        state: state.actual,
      },
    }),
  })

  // Config resource
  const configResource = resource({
    get: async () => ({ headers: {}, body: config }),
    put: async (h, b) => {
      config = { ...config, ...b }
      appendLog('info', 'Configuration updated', { keys: Object.keys(b) })
      return { headers: {}, body: config }
    },
  })

  // Tick handler for health checks
  const tickResource = resource({
    put: async (_h, _tick) => {
      metrics.healthChecks++

      // Only check health if running
      if (state.actual !== 'running') {
        return { headers: {}, body: { skipped: true, reason: 'not running' } }
      }

      const checks = []
      let ok = true

      // Check if app has a /health endpoint
      const healthPath = spec.healthCheck?.path || '/health'
      try {
        const appHealth = await app.get({ path: healthPath })
        const checkOk = appHealth.headers.condition !== 'error' && appHealth.body?.ok !== false
        checks.push({
          name: 'app',
          ok: checkOk,
          path: healthPath,
          response: appHealth.body,
        })
        if (!checkOk) ok = false
      } catch (e) {
        checks.push({ name: 'app', ok: false, error: e.message })
        ok = false
      }

      health = {
        ok,
        checks,
        lastCheck: Date.now(),
        checkCount: (health.checkCount || 0) + 1,
      }

      if (!ok) {
        appendLog('warn', 'Health check failed', { checks })
      }

      return { headers: {}, body: health }
    },
  })

  // Wrapper to track metrics on app access
  const appWrapper = resource({
    get: async h => {
      metrics.requests++
      try {
        return await app.get(h)
      } catch (e) {
        metrics.errors++
        throw e
      }
    },
    put: async (h, b) => {
      metrics.requests++
      try {
        return await app.put(h, b)
      } catch (e) {
        metrics.errors++
        throw e
      }
    },
  })

  return circuit(
    {
      bindings: {},
      ports: {
        state: 'stateResource',
        info: 'infoResource',
        health: 'healthResource',
        logs: 'logsResource',
        metrics: 'metricsResource',
        config: 'configResource',
        tick: 'tickResource',
        app: 'appWrapper',
      },
    },
    {
      stateResource,
      infoResource,
      healthResource,
      logsResource,
      metricsResource,
      configResource,
      tickResource,
      appWrapper,
    }
  )
}
