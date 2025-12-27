import { resource, routes, bind } from './resource.js'
import { circuit } from './circuit.js'
import { createDeployment } from './deployment.js'

/**
 * Create a daemon circuit that manages multiple deployments.
 *
 * Ports:
 * GET  /deployments        → list all deployments with status
 * PUT  /deployments        → create deployment { name, app, ... }
 * PUT  /deployments/delete → delete deployment { name }
 * GET  /d/:name/*          → forward to deployment
 * PUT  /d/:name/*          → forward to deployment
 * GET  /status             → daemon status with aggregated health
 * PUT  /tick               → trigger health checks on all deployments
 * @param {object} opts - Options
 * @param {object} opts.store - Optional store for persistence { get, put }
 * @returns {object} A daemon circuit
 */
export const createDaemon = (opts = {}) => {
  // Plain JS state - Map of name → { deployment, spec }
  const deployments = new Map()

  // Daemon start time for uptime
  const startedAt = Date.now()

  // Optional persistence store
  const store = opts.store

  // Helper to persist deployment specs (not the live circuit)
  const persistSpec = async (name, spec) => {
    if (store) {
      // Store just the serializable parts (not the app resource)
      const { app: _app, ...persistable } = spec
      await store.put({ path: `/deployments/${name}` }, persistable)
    }
  }

  const removeSpec = async name => {
    if (store) {
      await store.put({ path: `/deployments/${name}` }, null)
    }
  }

  // Helper to get deployment status
  const getDeploymentStatus = async (name, deployment) => {
    const [stateResult, healthResult] = await Promise.all([
      deployment.get({ path: '/state' }),
      deployment.get({ path: '/health' }),
    ])
    return {
      name,
      state: stateResult.body.actual,
      desired: stateResult.body.desired,
      healthy: healthResult.body.ok,
      startedAt: stateResult.body.startedAt,
    }
  }

  const deploymentsResource = routes({
    '': resource({
      get: async () => {
        // Get actual status from each deployment
        const statuses = await Promise.all(
          [...deployments.entries()].map(async ([name, { deployment }]) => {
            const status = await getDeploymentStatus(name, deployment)
            return [name, status]
          })
        )

        return {
          headers: {},
          body: {
            deployments: Object.fromEntries(statuses),
          },
        }
      },
      put: async (h, spec) => {
        const name = spec.name
        if (!name) {
          return { headers: { condition: 'invalid' }, body: { error: 'name required' } }
        }

        const app = spec.app
        if (!app) {
          return { headers: { condition: 'invalid' }, body: { error: 'app required' } }
        }

        // Check if already exists
        const exists = deployments.has(name)

        // Create deployment circuit wrapping the app
        const deployment = createDeployment(app, spec)
        deployments.set(name, { deployment, spec })

        // Persist spec
        await persistSpec(name, spec)

        return {
          headers: {},
          body: { name, created: !exists, updated: exists },
        }
      },
    }),

    delete: resource({
      put: async (h, body) => {
        const name = body.name
        if (!name) {
          return { headers: { condition: 'invalid' }, body: { error: 'name required' } }
        }

        if (!deployments.has(name)) {
          return { headers: { condition: 'not-found' }, body: { error: `deployment ${name} not found` } }
        }

        // Stop deployment first if running
        const { deployment } = deployments.get(name)
        const state = await deployment.get({ path: '/state' })
        if (state.body.actual === 'running') {
          await deployment.put({ path: '/state' }, { desired: 'stopped' })
        }

        // Remove
        deployments.delete(name)
        await removeSpec(name)

        return { headers: {}, body: { name, deleted: true } }
      },
    }),
  })

  // Router for /d/:name/* - forwards to deployment circuit
  const deploymentRouter = bind(
    'name',
    resource({
      get: async h => {
        const entry = deployments.get(h.params.name)
        if (!entry) {
          return { headers: { condition: 'not-found' }, body: null }
        }
        return entry.deployment.get({ ...h, path: h.path })
      },
      put: async (h, b) => {
        const entry = deployments.get(h.params.name)
        if (!entry) {
          return { headers: { condition: 'not-found' }, body: null }
        }
        return entry.deployment.put({ ...h, path: h.path }, b)
      },
    })
  )

  const statusResource = resource({
    get: async () => {
      // Aggregate health across all deployments
      let totalHealthy = 0
      let totalUnhealthy = 0
      let totalRunning = 0
      let totalStopped = 0

      for (const [, { deployment }] of deployments) {
        const [state, health] = await Promise.all([
          deployment.get({ path: '/state' }),
          deployment.get({ path: '/health' }),
        ])

        if (state.body.actual === 'running') totalRunning++
        else totalStopped++

        if (health.body.ok) totalHealthy++
        else totalUnhealthy++
      }

      return {
        headers: {},
        body: {
          status: 'running',
          uptime: Date.now() - startedAt,
          deploymentCount: deployments.size,
          summary: {
            running: totalRunning,
            stopped: totalStopped,
            healthy: totalHealthy,
            unhealthy: totalUnhealthy,
          },
        },
      }
    },
  })

  // Tick handler - forward to all deployments
  const tickResource = resource({
    put: async (h, tick) => {
      const results = []
      for (const [name, { deployment }] of deployments) {
        const result = await deployment.put({ path: '/tick' }, tick)
        results.push({ name, ...result.body })
      }
      return { headers: {}, body: { checked: results.length, results } }
    },
  })

  return circuit(
    {
      bindings: {},
      ports: {
        deployments: 'deploymentsResource',
        d: 'deploymentRouter',
        status: 'statusResource',
        tick: 'tickResource',
      },
    },
    { deploymentsResource, deploymentRouter, statusResource, tickResource }
  )
}
