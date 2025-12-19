/* global setTimeout */
import { describe, it, beforeAll, afterAll } from 'vitest'
import { expect } from 'vitest'
import { Bassline } from '@bassline/core'
import { createPlumber } from '@bassline/plumber'
import { createWsServerRoutes } from '@bassline/server-node'
import { WebSocket } from 'ws'
import { createRemoteRoutes } from '../src/index.js'

// Skip: requires running WebSocket server infrastructure
describe.skip('Remote WebSocket Mounts', () => {
  let serverBl, clientBl, plumber
  const PORT = 19876

  beforeAll(async () => {
    // Create server-side Bassline with real WS server routes
    serverBl = new Bassline()
    plumber = createPlumber()
    plumber.install(serverBl)

    // In-memory data store
    const store = new Map()
    serverBl.route('/data/:path*', {
      get: ({ params }) => {
        const data = store.get(params.path)
        if (!data) return null
        return { headers: { type: 'bl:///types/data' }, body: data }
      },
      put: ({ params, body }) => {
        store.set(params.path, body)
        return { headers: { type: 'bl:///types/data' }, body }
      },
    })

    // Install real WS server routes
    serverBl.install(createWsServerRoutes(plumber))

    // Start the WS server as a resource
    await serverBl.put(`bl:///server/ws/${PORT}`, {}, {})

    // Pre-populate some test data
    await serverBl.put('bl:///data/users/alice', {}, { name: 'Alice', role: 'admin' })
    await serverBl.put('bl:///data/users/bob', {}, { name: 'Bob', role: 'user' })

    // Create client-side Bassline with remote routes
    clientBl = new Bassline()
    clientBl.install(createRemoteRoutes({ WebSocket }))

    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 100))
  })

  afterAll(async () => {
    // Stop the server by... well, we don't have DELETE yet
    // The process will clean up
  })

  it('should create a remote connection', async () => {
    const result = await clientBl.put(
      'bl:///remote/ws/server1',
      {},
      {
        uri: `ws://localhost:${PORT}`,
        mount: '/server1',
      }
    )

    expect(result.headers.type).toBe('bl:///types/remote')
    expect(result.body.status).toBe('connecting')
    expect(result.body.mount).toBe('/server1')

    // Wait for connection to establish
    await new Promise((resolve) => setTimeout(resolve, 200))
  })

  it('should show connection as connected', async () => {
    const status = await clientBl.get('bl:///remote/ws/server1')
    expect(status.body.status).toBe('connected')
  })

  it('should GET remote resources through mount', async () => {
    const alice = await clientBl.get('bl:///server1/data/users/alice')
    expect(alice.body.name).toBe('Alice')
    expect(alice.body.role).toBe('admin')
  })

  it('should PUT to remote resources through mount', async () => {
    await clientBl.put(
      'bl:///server1/data/users/charlie',
      {},
      {
        name: 'Charlie',
        role: 'guest',
      }
    )

    // Verify it was stored on the server
    const charlie = await serverBl.get('bl:///data/users/charlie')
    expect(charlie.body.name).toBe('Charlie')

    // And accessible through the mount
    const charlieViaMount = await clientBl.get('bl:///server1/data/users/charlie')
    expect(charlieViaMount.body.name).toBe('Charlie')
  })

  it('should list remote connections', async () => {
    const list = await clientBl.get('bl:///remote/ws')
    expect(list.body.entries).toHaveLength(1)
    expect(list.body.entries[0].name).toBe('server1')
    expect(list.body.entries[0].status).toBe('connected')
  })

  it('should show client on server side', async () => {
    const serverStatus = await serverBl.get(`bl:///server/ws/${PORT}`)
    expect(serverStatus.body.clients).toBe(1)
  })
})
