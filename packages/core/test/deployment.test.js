import { describe, it, expect } from 'vitest'
import { resource } from '../src/resource.js'
import { createDeployment } from '../src/deployment.js'
import { createDaemon } from '../src/daemon.js'
import { createOrchestrator } from '../src/orchestrator.js'

describe('createDeployment', () => {
  it('wraps app with state and info ports', async () => {
    const app = resource({
      get: async () => ({ headers: {}, body: { hello: 'world' } }),
    })

    const deployment = createDeployment(app, { name: 'test-app', version: '1.0.0' })

    // Check info
    const info = await deployment.get({ path: '/info' })
    expect(info.body.name).toBe('test-app')
    expect(info.body.version).toBe('1.0.0')

    // Check initial state
    const state = await deployment.get({ path: '/state' })
    expect(state.body.desired).toBe('stopped')
    expect(state.body.actual).toBe('stopped')

    // Access app
    const appResult = await deployment.get({ path: '/app' })
    expect(appResult.body).toEqual({ hello: 'world' })
  })

  it('handles lifecycle state transitions', async () => {
    const app = resource({
      get: async () => ({ headers: {}, body: 'ok' }),
    })

    const deployment = createDeployment(app, { name: 'lifecycle-test' })

    // Start
    await deployment.put({ path: '/state' }, { desired: 'running' })
    let state = await deployment.get({ path: '/state' })
    expect(state.body.desired).toBe('running')
    expect(state.body.actual).toBe('running')
    expect(state.body.startedAt).toBeDefined()

    // Stop
    await deployment.put({ path: '/state' }, { desired: 'stopped' })
    state = await deployment.get({ path: '/state' })
    expect(state.body.desired).toBe('stopped')
    expect(state.body.actual).toBe('stopped')
    expect(state.body.stoppedAt).toBeDefined()
  })

  it('tracks metrics on app access', async () => {
    const app = resource({
      get: async () => ({ headers: {}, body: { data: 'test' } }),
    })

    const deployment = createDeployment(app, { name: 'metrics-test' })

    // Initial metrics
    let metrics = await deployment.get({ path: '/metrics' })
    expect(metrics.body.requests).toBe(0)
    expect(metrics.body.errors).toBe(0)

    // Make some requests
    await deployment.get({ path: '/app' })
    await deployment.get({ path: '/app/sub' })
    await deployment.put({ path: '/app' }, { foo: 'bar' })

    // Check metrics updated
    metrics = await deployment.get({ path: '/metrics' })
    expect(metrics.body.requests).toBe(3)
  })

  it('manages logs', async () => {
    const app = resource({
      get: async () => ({ headers: {}, body: 'ok' }),
    })

    const deployment = createDeployment(app, { name: 'logs-test' })

    // Start generates logs
    await deployment.put({ path: '/state' }, { desired: 'running' })

    // Check logs exist
    let logs = await deployment.get({ path: '/logs' })
    expect(logs.body.length).toBeGreaterThan(0)
    expect(logs.body.some(l => l.message.includes('Starting'))).toBe(true)
    expect(logs.body.some(l => l.message.includes('started'))).toBe(true)

    // Append custom log
    await deployment.put({ path: '/logs' }, { level: 'warn', message: 'Custom warning' })

    logs = await deployment.get({ path: '/logs' })
    expect(logs.body.some(l => l.message === 'Custom warning')).toBe(true)
    expect(logs.body.find(l => l.message === 'Custom warning').level).toBe('warn')
  })

  it('manages config', async () => {
    const app = resource({
      get: async () => ({ headers: {}, body: 'ok' }),
    })

    const deployment = createDeployment(app, {
      name: 'config-test',
      config: { debug: false, timeout: 5000 },
    })

    // Check initial config
    let config = await deployment.get({ path: '/config' })
    expect(config.body.debug).toBe(false)
    expect(config.body.timeout).toBe(5000)

    // Update config
    await deployment.put({ path: '/config' }, { debug: true })

    config = await deployment.get({ path: '/config' })
    expect(config.body.debug).toBe(true)
    expect(config.body.timeout).toBe(5000) // Unchanged

    // Check config update was logged
    const logs = await deployment.get({ path: '/logs' })
    expect(logs.body.some(l => l.message.includes('Configuration updated'))).toBe(true)
  })

  it('performs health checks on tick', async () => {
    const app = resource({
      get: async h => {
        if (h.path === '/health') {
          return { headers: {}, body: { ok: true, db: 'connected' } }
        }
        return { headers: {}, body: 'ok' }
      },
    })

    const deployment = createDeployment(app, { name: 'health-test' })

    // Health when stopped should report not ok
    let health = await deployment.get({ path: '/health' })
    expect(health.body.ok).toBe(false) // Not running

    // Start deployment
    await deployment.put({ path: '/state' }, { desired: 'running' })

    // Send tick to trigger health check
    await deployment.put({ path: '/tick' }, { timer: 'health', tick: 1 })

    // Check health updated
    health = await deployment.get({ path: '/health' })
    expect(health.body.ok).toBe(true)
    expect(health.body.lastCheck).toBeDefined()
    expect(health.body.checks).toHaveLength(1)
    expect(health.body.checks[0].name).toBe('app')
    expect(health.body.checks[0].ok).toBe(true)
    expect(health.body.checks[0].response).toEqual({ ok: true, db: 'connected' })
  })

  it('detects unhealthy app', async () => {
    const app = resource({
      get: async h => {
        if (h.path === '/health') {
          return { headers: {}, body: { ok: false, error: 'db disconnected' } }
        }
        return { headers: {}, body: 'ok' }
      },
    })

    const deployment = createDeployment(app, { name: 'unhealthy-test' })

    // Start and check health
    await deployment.put({ path: '/state' }, { desired: 'running' })
    await deployment.put({ path: '/tick' }, { timer: 'health', tick: 1 })

    const health = await deployment.get({ path: '/health' })
    expect(health.body.ok).toBe(false)
    expect(health.body.checks[0].ok).toBe(false)

    // Should log warning
    const logs = await deployment.get({ path: '/logs' })
    expect(logs.body.some(l => l.level === 'warn' && l.message.includes('Health check failed'))).toBe(true)
  })

  it('skips health check when not running', async () => {
    const app = resource({
      get: async () => ({ headers: {}, body: { ok: true } }),
    })

    const deployment = createDeployment(app, { name: 'skip-test' })

    // Send tick while stopped
    const result = await deployment.put({ path: '/tick' }, { tick: 1 })
    expect(result.body.skipped).toBe(true)
    expect(result.body.reason).toBe('not running')
  })

  it('tracks uptime in metrics', async () => {
    const app = resource({
      get: async () => ({ headers: {}, body: 'ok' }),
    })

    const deployment = createDeployment(app, { name: 'uptime-test' })

    // Uptime is 0 when stopped
    let metrics = await deployment.get({ path: '/metrics' })
    expect(metrics.body.uptime).toBe(0)

    // Start
    await deployment.put({ path: '/state' }, { desired: 'running' })

    // Wait a tiny bit
    await new Promise(r => setTimeout(r, 10))

    // Uptime should be > 0
    metrics = await deployment.get({ path: '/metrics' })
    expect(metrics.body.uptime).toBeGreaterThan(0)
    expect(metrics.body.state).toBe('running')
  })
})

describe('createDaemon', () => {
  it('manages multiple deployments', async () => {
    const daemon = createDaemon()

    // Initially empty
    const list = await daemon.get({ path: '/deployments' })
    expect(Object.keys(list.body.deployments)).toHaveLength(0)

    // Create app resources
    const app1 = resource({
      get: async () => ({ headers: {}, body: { app: 1 } }),
    })
    const app2 = resource({
      get: async () => ({ headers: {}, body: { app: 2 } }),
    })

    // Deploy apps
    await daemon.put({ path: '/deployments' }, { name: 'app1', app: app1 })
    await daemon.put({ path: '/deployments' }, { name: 'app2', app: app2 })

    // List deployments
    const updated = await daemon.get({ path: '/deployments' })
    expect(Object.keys(updated.body.deployments)).toHaveLength(2)
    expect(updated.body.deployments.app1).toBeDefined()
    expect(updated.body.deployments.app2).toBeDefined()

    // Access via /d/:name/app
    const result1 = await daemon.get({ path: '/d/app1/app' })
    expect(result1.body).toEqual({ app: 1 })

    const result2 = await daemon.get({ path: '/d/app2/app' })
    expect(result2.body).toEqual({ app: 2 })
  })

  it('exposes deployment state', async () => {
    const daemon = createDaemon()

    const app = resource({
      get: async () => ({ headers: {}, body: 'ok' }),
    })

    await daemon.put({ path: '/deployments' }, { name: 'myapp', app })

    // Check state
    const state = await daemon.get({ path: '/d/myapp/state' })
    expect(state.body.desired).toBe('stopped')

    // Start it
    await daemon.put({ path: '/d/myapp/state' }, { desired: 'running' })
    const running = await daemon.get({ path: '/d/myapp/state' })
    expect(running.body.actual).toBe('running')
  })

  it('returns not-found for unknown deployment', async () => {
    const daemon = createDaemon()

    const result = await daemon.get({ path: '/d/unknown/app' })
    expect(result.headers.condition).toBe('not-found')
  })

  it('exposes daemon status', async () => {
    const daemon = createDaemon()

    const status = await daemon.get({ path: '/status' })
    expect(status.body.status).toBe('running')
    expect(status.body.uptime).toBeGreaterThanOrEqual(0)
    expect(status.body.deploymentCount).toBe(0)
    expect(status.body.summary).toEqual({
      running: 0,
      stopped: 0,
      healthy: 0,
      unhealthy: 0,
    })
  })

  it('deletes deployments', async () => {
    const daemon = createDaemon()

    const app = resource({
      get: async () => ({ headers: {}, body: 'ok' }),
    })

    // Create deployment
    await daemon.put({ path: '/deployments' }, { name: 'myapp', app })
    let list = await daemon.get({ path: '/deployments' })
    expect(Object.keys(list.body.deployments)).toHaveLength(1)

    // Delete it
    const result = await daemon.put({ path: '/deployments/delete' }, { name: 'myapp' })
    expect(result.body.deleted).toBe(true)

    // Should be gone
    list = await daemon.get({ path: '/deployments' })
    expect(Object.keys(list.body.deployments)).toHaveLength(0)

    // Should return not-found
    const notFound = await daemon.get({ path: '/d/myapp/state' })
    expect(notFound.headers.condition).toBe('not-found')
  })

  it('stops running deployment before deletion', async () => {
    const daemon = createDaemon()

    const app = resource({
      get: async () => ({ headers: {}, body: 'ok' }),
    })

    // Create and start deployment
    await daemon.put({ path: '/deployments' }, { name: 'myapp', app })
    await daemon.put({ path: '/d/myapp/state' }, { desired: 'running' })

    // Verify it's running
    const state = await daemon.get({ path: '/d/myapp/state' })
    expect(state.body.actual).toBe('running')

    // Delete it - should stop first
    await daemon.put({ path: '/deployments/delete' }, { name: 'myapp' })

    // Deployment is gone
    const list = await daemon.get({ path: '/deployments' })
    expect(Object.keys(list.body.deployments)).toHaveLength(0)
  })

  it('returns error for deleting unknown deployment', async () => {
    const daemon = createDaemon()

    const result = await daemon.put({ path: '/deployments/delete' }, { name: 'unknown' })
    expect(result.headers.condition).toBe('not-found')
  })

  it('aggregates status across deployments', async () => {
    const daemon = createDaemon()

    const healthyApp = resource({
      get: async h => {
        if (h.path === '/health') return { headers: {}, body: { ok: true } }
        return { headers: {}, body: 'ok' }
      },
    })

    const unhealthyApp = resource({
      get: async h => {
        if (h.path === '/health') return { headers: {}, body: { ok: false } }
        return { headers: {}, body: 'ok' }
      },
    })

    // Deploy both apps
    await daemon.put({ path: '/deployments' }, { name: 'healthy', app: healthyApp })
    await daemon.put({ path: '/deployments' }, { name: 'unhealthy', app: unhealthyApp })

    // Start both
    await daemon.put({ path: '/d/healthy/state' }, { desired: 'running' })
    await daemon.put({ path: '/d/unhealthy/state' }, { desired: 'running' })

    // Trigger health checks
    await daemon.put({ path: '/tick' }, { tick: 1 })

    // Check aggregated status
    const status = await daemon.get({ path: '/status' })
    expect(status.body.deploymentCount).toBe(2)
    expect(status.body.summary.running).toBe(2)
    expect(status.body.summary.stopped).toBe(0)
    expect(status.body.summary.healthy).toBe(1)
    expect(status.body.summary.unhealthy).toBe(1)
  })

  it('forwards tick to all deployments', async () => {
    const daemon = createDaemon()

    const app1 = resource({
      get: async h => {
        if (h.path === '/health') return { headers: {}, body: { ok: true } }
        return { headers: {}, body: 'ok' }
      },
    })
    const app2 = resource({
      get: async h => {
        if (h.path === '/health') return { headers: {}, body: { ok: true } }
        return { headers: {}, body: 'ok' }
      },
    })

    await daemon.put({ path: '/deployments' }, { name: 'app1', app: app1 })
    await daemon.put({ path: '/deployments' }, { name: 'app2', app: app2 })

    // Start both
    await daemon.put({ path: '/d/app1/state' }, { desired: 'running' })
    await daemon.put({ path: '/d/app2/state' }, { desired: 'running' })

    // Send tick
    const result = await daemon.put({ path: '/tick' }, { tick: 1 })
    expect(result.body.checked).toBe(2)
    expect(result.body.results).toHaveLength(2)

    // Both should have health checks now
    const health1 = await daemon.get({ path: '/d/app1/health' })
    const health2 = await daemon.get({ path: '/d/app2/health' })
    expect(health1.body.lastCheck).toBeDefined()
    expect(health2.body.lastCheck).toBeDefined()
  })

  it('lists deployments with actual status', async () => {
    const daemon = createDaemon()

    const app = resource({
      get: async h => {
        if (h.path === '/health') return { headers: {}, body: { ok: true } }
        return { headers: {}, body: 'ok' }
      },
    })

    await daemon.put({ path: '/deployments' }, { name: 'myapp', app })
    await daemon.put({ path: '/d/myapp/state' }, { desired: 'running' })

    const list = await daemon.get({ path: '/deployments' })
    expect(list.body.deployments.myapp.state).toBe('running')
    expect(list.body.deployments.myapp.desired).toBe('running')
  })

  it('persists deployment specs to store', async () => {
    // Mock store
    const stored = {}
    const mockStore = {
      get: async h => ({ headers: {}, body: stored[h.path] }),
      put: async (h, b) => {
        stored[h.path] = b
        return { headers: {}, body: b }
      },
    }

    const daemon = createDaemon({ store: mockStore })

    const app = resource({
      get: async () => ({ headers: {}, body: 'ok' }),
    })

    // Deploy
    await daemon.put(
      { path: '/deployments' },
      {
        name: 'myapp',
        app,
        version: '1.0.0',
        labels: { env: 'prod' },
      }
    )

    // Check store has the spec (without app)
    expect(stored['/deployments/myapp']).toBeDefined()
    expect(stored['/deployments/myapp'].name).toBe('myapp')
    expect(stored['/deployments/myapp'].version).toBe('1.0.0')
    expect(stored['/deployments/myapp'].labels).toEqual({ env: 'prod' })
    expect(stored['/deployments/myapp'].app).toBeUndefined() // Not persisted

    // Delete
    await daemon.put({ path: '/deployments/delete' }, { name: 'myapp' })
    expect(stored['/deployments/myapp']).toBeNull()
  })
})

describe('createOrchestrator', () => {
  it('routes to multiple nodes', async () => {
    // Create two daemons as "nodes"
    const daemon1 = createDaemon()
    const daemon2 = createDaemon()

    // Create orchestrator with both daemons
    const orchestrator = createOrchestrator({
      node1: daemon1,
      node2: daemon2,
    })

    // List nodes
    const nodes = await orchestrator.get({ path: '/nodes' })
    expect(nodes.body.nodes).toContain('node1')
    expect(nodes.body.nodes).toContain('node2')

    // Access node1 status via orchestrator
    const status1 = await orchestrator.get({ path: '/n/node1/status' })
    expect(status1.body.status).toBe('running')

    // Access node2 status via orchestrator
    const status2 = await orchestrator.get({ path: '/n/node2/status' })
    expect(status2.body.status).toBe('running')
  })

  it('deploys to specific node', async () => {
    const daemon1 = createDaemon()
    const daemon2 = createDaemon()

    const orchestrator = createOrchestrator({
      node1: daemon1,
      node2: daemon2,
    })

    const app = resource({
      get: async () => ({ headers: {}, body: { deployed: true } }),
    })

    // Deploy to node1
    await orchestrator.put({ path: '/deploy' }, { name: 'myapp', node: 'node1', app })

    // Should be on node1
    const onNode1 = await orchestrator.get({ path: '/n/node1/d/myapp/app' })
    expect(onNode1.body).toEqual({ deployed: true })

    // Should NOT be on node2
    const onNode2 = await orchestrator.get({ path: '/n/node2/d/myapp/app' })
    expect(onNode2.headers.condition).toBe('not-found')
  })

  it('returns error for unknown node', async () => {
    const orchestrator = createOrchestrator({})

    const result = await orchestrator.put({ path: '/deploy' }, { name: 'app', node: 'unknown', app: {} })
    expect(result.headers.condition).toBe('not-found')
  })
})

describe('end-to-end deployment flow', () => {
  it('orchestrator → daemon → deployment → app', async () => {
    // 1. Create simple app
    const myApp = resource({
      get: async h => {
        if (h.path === '/users/123') {
          return { headers: {}, body: { id: 123, name: 'Alice' } }
        }
        return { headers: {}, body: { endpoints: ['/users/:id'] } }
      },
      put: async (h, b) => {
        return { headers: {}, body: { updated: true, ...b } }
      },
    })

    // 2. Create daemon
    const daemon = createDaemon()

    // 3. Create orchestrator with daemon as a node
    const orchestrator = createOrchestrator({ local: daemon })

    // 4. Deploy app via orchestrator
    const deployResult = await orchestrator.put(
      { path: '/deploy' },
      { name: 'api', node: 'local', app: myApp, version: '2.0.0' }
    )
    expect(deployResult.body.created).toBe(true)

    // 5. Access deployed app via full path
    const userResult = await orchestrator.get({ path: '/n/local/d/api/app/users/123' })
    expect(userResult.body).toEqual({ id: 123, name: 'Alice' })

    // 6. Check deployment info
    const info = await orchestrator.get({ path: '/n/local/d/api/info' })
    expect(info.body.name).toBe('api')
    expect(info.body.version).toBe('2.0.0')

    // 7. Update deployment state
    await orchestrator.put({ path: '/n/local/d/api/state' }, { desired: 'running' })
    const state = await orchestrator.get({ path: '/n/local/d/api/state' })
    expect(state.body.actual).toBe('running')

    // 8. Check daemon knows about it
    const deployments = await orchestrator.get({ path: '/n/local/deployments' })
    expect(deployments.body.deployments.api).toBeDefined()
  })
})
