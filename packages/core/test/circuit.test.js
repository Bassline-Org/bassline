import { describe, it, expect } from 'vitest'
import { resource } from '../src/resource.js'
import { circuit, withKit } from '../src/circuit.js'

describe('withKit', () => {
  it('injects kit into get calls', async () => {
    let receivedKit = null
    const inner = resource({
      get: async h => {
        receivedKit = h.kit
        return { headers: {}, body: 'ok' }
      },
    })

    const kit = resource({
      get: async () => ({ headers: {}, body: 'from kit' }),
    })

    const wrapped = withKit(inner, kit)
    await wrapped.get({ path: '/' })

    expect(receivedKit).toBe(kit)
  })

  it('injects kit into put calls', async () => {
    let receivedKit = null
    const inner = resource({
      put: async h => {
        receivedKit = h.kit
        return { headers: {}, body: 'ok' }
      },
    })

    const kit = resource({
      get: async () => ({ headers: {}, body: 'from kit' }),
    })

    const wrapped = withKit(inner, kit)
    await wrapped.put({ path: '/' }, 'data')

    expect(receivedKit).toBe(kit)
  })

  it('preserves other headers', async () => {
    let receivedHeaders = null
    const inner = resource({
      get: async h => {
        receivedHeaders = h
        return { headers: {}, body: 'ok' }
      },
    })

    const kit = resource({})
    const wrapped = withKit(inner, kit)
    await wrapped.get({ path: '/test', params: { foo: 'bar' } })

    expect(receivedHeaders.path).toBe('/test')
    expect(receivedHeaders.params.foo).toBe('bar')
  })
})

describe('circuit', () => {
  it('routes through ports to nodes', async () => {
    const nodeA = resource({
      get: async () => ({ headers: {}, body: 'from A' }),
    })
    const nodeB = resource({
      get: async () => ({ headers: {}, body: 'from B' }),
    })

    const c = circuit(
      {
        ports: {
          '/a': 'nodeA',
          '/b': 'nodeB',
        },
      },
      { nodeA, nodeB }
    )

    const resultA = await c.get({ path: '/a' })
    expect(resultA.body).toBe('from A')

    const resultB = await c.get({ path: '/b' })
    expect(resultB.body).toBe('from B')
  })

  it('passes remaining path through ports', async () => {
    const node = resource({
      get: async h => ({ headers: {}, body: h.path }),
    })

    const c = circuit({ ports: { '/data': 'node' } }, { node })

    const result = await c.get({ path: '/data/foo/bar' })
    expect(result.body).toBe('/foo/bar')
  })

  it('constructs kit from bindings', async () => {
    const input = resource({
      get: async () => ({ headers: {}, body: 42 }),
    })

    const processor = resource({
      get: async h => {
        // Read from kit
        const val = await h.kit.get({ path: '/in' })
        return { headers: {}, body: val.body * 2 }
      },
    })

    const c = circuit(
      {
        bindings: {
          processor: { '/in': 'input' },
        },
        ports: {
          '/process': 'processor',
        },
      },
      { input, processor }
    )

    const result = await c.get({ path: '/process' })
    expect(result.body).toBe(84)
  })

  it('allows nodes to communicate via kit', async () => {
    let storedValue = 0

    const input = resource({
      get: async () => ({ headers: {}, body: storedValue }),
      put: async (h, v) => {
        storedValue = v
        return { headers: {}, body: 'ok' }
      },
    })

    const output = resource({
      get: async () => ({ headers: {}, body: storedValue * 2 }),
    })

    const processor = resource({
      put: async h => {
        // Read input, write to output
        const val = await h.kit.get({ path: '/in' })
        await h.kit.put({ path: '/out' }, val.body + 10)
        return { headers: {}, body: 'processed' }
      },
    })

    const c = circuit(
      {
        bindings: {
          processor: { '/in': 'input', '/out': 'input' },
        },
        ports: {
          '/write': 'input',
          '/run': 'processor',
          '/read': 'output',
        },
      },
      { input, processor, output }
    )

    // Write value
    await c.put({ path: '/write' }, 5)
    expect(storedValue).toBe(5)

    // Process it
    await c.put({ path: '/run' }, {})
    expect(storedValue).toBe(15) // 5 + 10

    // Read output
    const result = await c.get({ path: '/read' })
    expect(result.body).toBe(30) // 15 * 2
  })

  it('isolates nodes without bindings', async () => {
    const isolated = resource({
      get: async h => {
        // Should have no kit
        return { headers: {}, body: h.kit === undefined }
      },
    })

    const c = circuit(
      {
        bindings: {}, // No bindings
        ports: { '/check': 'isolated' },
      },
      { isolated }
    )

    const result = await c.get({ path: '/check' })
    expect(result.body).toBe(true)
  })

  it('returns not-found for unknown ports', async () => {
    const node = resource({
      get: async () => ({ headers: {}, body: 'ok' }),
    })

    const c = circuit({ ports: { '/known': 'node' } }, { node })

    const result = await c.get({ path: '/unknown' })
    expect(result.headers.condition).toBe('not-found')
  })

  it('supports nested paths in bindings', async () => {
    const data = resource({
      get: async h => ({ headers: {}, body: `data at ${h.path}` }),
    })

    const reader = resource({
      get: async h => {
        const result = await h.kit.get({ path: '/source/nested/path' })
        return result
      },
    })

    const c = circuit(
      {
        bindings: {
          reader: { '/source': 'data' },
        },
        ports: { '/read': 'reader' },
      },
      { data, reader }
    )

    const result = await c.get({ path: '/read' })
    expect(result.body).toBe('data at /nested/path')
  })

  it('supports circuits containing circuits', async () => {
    // Inner circuit
    const counter = resource({
      get: async () => ({ headers: {}, body: 10 }),
    })

    const innerCircuit = circuit({ ports: { '/value': 'counter' } }, { counter })

    // Outer circuit uses inner circuit as a node
    const doubler = resource({
      get: async h => {
        const val = await h.kit.get({ path: '/source/value' })
        return { headers: {}, body: val.body * 2 }
      },
    })

    const outerCircuit = circuit(
      {
        bindings: {
          doubler: { '/source': 'inner' },
        },
        ports: {
          '/double': 'doubler',
          '/raw': 'inner',
        },
      },
      { inner: innerCircuit, doubler }
    )

    const rawResult = await outerCircuit.get({ path: '/raw/value' })
    expect(rawResult.body).toBe(10)

    const doubledResult = await outerCircuit.get({ path: '/double' })
    expect(doubledResult.body).toBe(20)
  })
})
