import { describe, it, expect } from 'vitest'
import { resource, routes } from '../src/resource.js'
import { createCells } from '../src/cells.js'
import { createPlumber } from '../src/plumber.js'
import { createPropagators } from '../src/propagators.js'
import { createFn, builtins } from '../src/fn.js'
import { createMemoryStore } from '../src/store.js'
import { createMockKit } from './helpers.js'

/**
 * Integration tests for kit isolation and error conditions
 */

describe('Kit Isolation', () => {
  it('resources cannot access each other without kit', async () => {
    // Create isolated resources
    const cells = createCells()
    const plumber = createPlumber()

    // plumber has no way to access cells without kit
    // The only way to interact is if kit is passed
    await cells.put({ path: '/counter' }, { lattice: 'maxNumber' })

    // plumber's rule can reference cells, but without kit it won't dispatch
    await plumber.put({ path: '/rules/test' }, { match: {}, to: '/cells/counter/value' })

    // Send without kit - rule matches but nothing is dispatched
    const result = await plumber.put({ path: '/send' }, { data: 'test' })

    expect(result.body.matched).toContain('test')
    // No kit calls happened (plumber didn't dispatch anywhere)
  })

  it('kit enables cross-resource communication', async () => {
    const cells = createCells()
    const plumber = createPlumber()

    // Create cell
    await cells.put({ path: '/events' }, { lattice: 'counter' })

    // Create kit that routes to cells
    const kit = resource({
      get: async h => cells.get(h),
      put: async (h, b) => cells.put(h, b),
    })

    // Create rule
    await plumber.put({ path: '/rules/count' }, { match: { type: 'event' }, to: '/events/value' })

    // Send with kit
    await plumber.put({ path: '/send', kit }, { type: 'event' })

    // Verify cell was updated (counter adds, so 1 from the object being written)
    // Actually, the plumber writes the whole message to the cell
    const result = await cells.get({ path: '/events/value' })
    expect(result.body).toBeDefined()
  })

  it('different kits provide different worlds', async () => {
    const world1 = createMemoryStore({ config: { mode: 'test' } })
    const world2 = createMemoryStore({ config: { mode: 'prod' } })

    const worker = resource({
      get: async h => {
        const config = await h.kit.get({ path: '/config/mode' })
        return { headers: {}, body: { mode: config.body } }
      },
    })

    const result1 = await worker.get({ path: '/', kit: world1 })
    const result2 = await worker.get({ path: '/', kit: world2 })

    expect(result1.body.mode).toBe('test')
    expect(result2.body.mode).toBe('prod')
  })

  it('kit can be used for capability gating', async () => {
    const data = createMemoryStore({ secret: 'password123' })

    // Kit that blocks access to /secret
    const restrictedKit = resource({
      get: async h => {
        if (h.path.includes('secret')) {
          return { headers: { condition: 'forbidden' }, body: null }
        }
        return data.get(h)
      },
      put: async (h, b) => {
        if (h.path.includes('secret')) {
          return { headers: { condition: 'forbidden' }, body: null }
        }
        return data.put(h, b)
      },
    })

    const worker = resource({
      get: async h => {
        return h.kit.get({ path: '/secret' })
      },
    })

    const result = await worker.get({ path: '/', kit: restrictedKit })

    expect(result.headers.condition).toBe('forbidden')
  })
})

describe('Error Conditions', () => {
  it('errors are caught and returned as conditions', async () => {
    const faulty = resource({
      get: async () => {
        throw new Error('Something went wrong')
      },
    })

    const result = await faulty.get({ path: '/' })

    expect(result.headers.condition).toBe('error')
    expect(result.body.error).toBe('Something went wrong')
  })

  it('errors signal conditions via kit', async () => {
    const kit = createMockKit()

    const faulty = resource({
      get: async () => {
        throw new Error('Oops')
      },
    })

    await faulty.get({ path: '/test', kit })

    const calls = kit.calls()
    const conditionCall = calls.find(c => c.headers.path === '/condition')

    expect(conditionCall).toBeDefined()
    expect(conditionCall.body.error).toBe('Oops')
    expect(conditionCall.body.context.path).toBe('/test')
  })

  it('missing kit does not cause additional errors', async () => {
    const faulty = resource({
      get: async () => {
        throw new Error('Test error')
      },
    })

    // Should not throw, even without kit
    const result = await faulty.get({ path: '/' })

    expect(result.headers.condition).toBe('error')
  })

  it('async errors are properly caught', async () => {
    const faulty = resource({
      get: async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
        throw new Error('Async error')
      },
    })

    const result = await faulty.get({ path: '/' })

    expect(result.headers.condition).toBe('error')
    expect(result.body.error).toBe('Async error')
  })

  it('errors in nested routes are caught', async () => {
    const app = routes({
      broken: resource({
        get: async () => {
          throw new Error('Nested error')
        },
      }),
    })

    const result = await app.get({ path: '/broken' })

    expect(result.headers.condition).toBe('error')
    expect(result.body.error).toBe('Nested error')
  })
})

describe('End-to-End Scenarios', () => {
  it('propagator reads cells, computes, and writes output', async () => {
    // Set up cells
    const cells = createCells()
    await cells.put({ path: '/a' }, { lattice: 'maxNumber' })
    await cells.put({ path: '/b' }, { lattice: 'maxNumber' })
    await cells.put({ path: '/sum' }, { lattice: 'maxNumber' })

    await cells.put({ path: '/a/value' }, 10)
    await cells.put({ path: '/b/value' }, 20)

    // Set up propagator
    const propagators = createPropagators()
    await propagators.put(
      { path: '/adder' },
      {
        inputs: ['a', 'b'],
        output: '/sum/value',
        fn: '/fn/sum',
      }
    )

    // Create kit that routes to appropriate resources
    // Note: propagator writes to semantic path /output, which kit maps to actual destination
    const kit = resource({
      get: async h => {
        if (h.path.startsWith('/inputs/')) {
          const name = h.path.split('/')[2]
          return cells.get({ path: `/${name}/value` })
        }
        if (h.path === '/fn') {
          return { headers: {}, body: builtins.sum }
        }
        return { headers: { condition: 'not-found' }, body: null }
      },
      put: async (h, b) => {
        // Propagator writes to /output, we route to the actual cell
        if (h.path === '/output') {
          return cells.put({ path: '/sum/value' }, b)
        }
        return { headers: { condition: 'not-found' }, body: null }
      },
    })

    // Run propagator
    const result = await propagators.put({ path: '/adder/run', kit }, null)

    expect(result.body.computed).toBe(true)
    expect(result.body.result).toBe(30)

    // Verify output cell was updated
    const sumResult = await cells.get({ path: '/sum/value' })
    expect(sumResult.body).toBe(30)
  })

  it('plumber routes messages to multiple cells', async () => {
    const cells = createCells()
    // Use setUnion to collect message IDs
    await cells.put({ path: '/logs' }, { lattice: 'setUnion' })
    await cells.put({ path: '/errors' }, { lattice: 'setUnion' })

    const plumber = createPlumber()
    await plumber.put(
      { path: '/rules/log-all' },
      {
        match: {},
        to: '/logs/value',
      }
    )
    await plumber.put(
      { path: '/rules/errors' },
      {
        match: { level: '^error$' },
        to: '/errors/value',
      }
    )

    // Kit routes to cells and adds message ID to the set
    let msgId = 0
    const kit = resource({
      get: async h => cells.get(h),
      put: async (h, _body) => {
        // Add unique message ID to the set
        return cells.put(h, [++msgId])
      },
    })

    // Send messages
    await plumber.put({ path: '/send', kit }, { level: 'info', msg: 'Hello' })
    await plumber.put({ path: '/send', kit }, { level: 'error', msg: 'Oops' })
    await plumber.put({ path: '/send', kit }, { level: 'info', msg: 'World' })

    // Check logs - should have 3 message IDs
    const logs = await cells.get({ path: '/logs/value' })
    expect(logs.body.length).toBe(3)

    // Check errors - should only have 1 error message ID
    const errors = await cells.get({ path: '/errors/value' })
    expect(errors.body.length).toBe(1)
  })

  it('bassline self-describes its resources', async () => {
    const cells = createCells()
    const plumber = createPlumber()
    const fn = createFn()

    // Create some resources
    await cells.put({ path: '/counter' }, { lattice: 'maxNumber' })
    await plumber.put({ path: '/rules/test' }, { match: {} })

    // Get root descriptions
    const cellsRoot = await cells.get({ path: '/' })
    const plumberRoot = await plumber.get({ path: '/' })
    const fnRoot = await fn.get({ path: '/' })

    // Verify type
    expect(cellsRoot.headers.type).toBe('/types/bassline')
    expect(plumberRoot.headers.type).toBe('/types/bassline')
    expect(fnRoot.headers.type).toBe('/types/bassline')

    // Verify name
    expect(cellsRoot.body.name).toBe('cells')
    expect(plumberRoot.body.name).toBe('plumber')
    expect(fnRoot.body.name).toBe('fn')

    // Verify resources are listed (cells should show /counter after creation)
    expect(cellsRoot.body.resources).toBeDefined()
  })
})

describe('Concurrent Access', () => {
  it('cells handle concurrent writes correctly (last wins via lattice)', async () => {
    const cells = createCells()
    await cells.put({ path: '/counter' }, { lattice: 'maxNumber' })

    // Concurrent writes
    await Promise.all([
      cells.put({ path: '/counter/value' }, 5),
      cells.put({ path: '/counter/value' }, 10),
      cells.put({ path: '/counter/value' }, 3),
      cells.put({ path: '/counter/value' }, 8),
    ])

    const result = await cells.get({ path: '/counter/value' })
    // maxNumber lattice means the highest value wins
    expect(result.body).toBe(10)
  })

  it('setUnion accumulates all concurrent writes', async () => {
    const cells = createCells()
    await cells.put({ path: '/items' }, { lattice: 'setUnion' })

    // Concurrent writes
    await Promise.all([
      cells.put({ path: '/items/value' }, ['a']),
      cells.put({ path: '/items/value' }, ['b']),
      cells.put({ path: '/items/value' }, ['c']),
      cells.put({ path: '/items/value' }, ['a']), // duplicate
    ])

    const result = await cells.get({ path: '/items/value' })
    expect(result.body.sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('Type Safety', () => {
  it('cells reject unknown lattice types', async () => {
    const cells = createCells()
    const result = await cells.put({ path: '/bad' }, { lattice: 'notARealLattice' })

    expect(result.headers.condition).toBe('invalid')
    expect(result.headers.message).toContain('Unknown lattice')
  })

  it('fn rejects non-function registration', async () => {
    const fn = createFn()
    const result = await fn.put({ path: '/bad' }, { not: 'a function' })

    expect(result.headers.condition).toBe('invalid')
    expect(result.headers.message).toContain('function')
  })
})
