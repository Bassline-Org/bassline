/**
 * Integration tests for cells + propagators + handlers working together.
 *
 * These tests verify that the core reactive system functions correctly
 * when multiple packages are composed together.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { Bassline } from '../../packages/core/src/bassline.js'
import { createCellRoutes } from '../../packages/cells/src/cell.js'
import { createPropagatorRoutes } from '../../packages/propagators/src/propagator.js'
import { createHandlerSystem } from '../../packages/handlers/src/index.js'
import { createPlumber } from '../../packages/plumber/src/plumber.js'

describe('cells + propagators integration', () => {
  let bl
  let cells
  let propagators

  beforeEach(() => {
    bl = new Bassline()

    // Install plumber first (propagators depend on it)
    const plumber = createPlumber()
    bl.mount('/plumb', plumber.routes)
    bl._plumber = plumber

    // Install handlers
    const handlerSystem = createHandlerSystem()
    bl.mount('/handlers', handlerSystem.routes)
    bl._handlers = handlerSystem.registry

    // Install cells with propagator notification
    cells = createCellRoutes({
      onCellChange: async ({ uri }) => {
        await propagators?.onCellChange(uri)
      },
    })
    cells.install(bl)
    bl._cells = cells

    // Install propagators
    propagators = createPropagatorRoutes({ bl })
    propagators.install(bl)
    bl._propagators = propagators
  })

  it('creates cells and retrieves values', async () => {
    // Create a cell
    await bl.put('bl:///cells/counter', {}, { lattice: 'maxNumber' })

    // Set initial value
    await bl.put('bl:///cells/counter/value', {}, 5)

    // Retrieve value
    const result = await bl.get('bl:///cells/counter/value')
    expect(result.body).toBe(5)
  })

  it('respects lattice semantics (max)', async () => {
    await bl.put('bl:///cells/counter', {}, { lattice: 'maxNumber' })

    // Merge values - max should win
    await bl.put('bl:///cells/counter/value', {}, 5)
    await bl.put('bl:///cells/counter/value', {}, 3) // ignored, 3 < 5
    await bl.put('bl:///cells/counter/value', {}, 10) // wins, 10 > 5

    const result = await bl.get('bl:///cells/counter/value')
    expect(result.body).toBe(10)
  })

  it('respects lattice semantics (setUnion)', async () => {
    await bl.put('bl:///cells/tags', {}, { lattice: 'setUnion' })

    await bl.put('bl:///cells/tags/value', {}, ['a', 'b'])
    await bl.put('bl:///cells/tags/value', {}, ['b', 'c'])

    const result = await bl.get('bl:///cells/tags/value')
    expect(result.body).toEqual(['a', 'b', 'c'])
  })

  it('creates propagators that compute derived values', async () => {
    // Create input cells
    await bl.put('bl:///cells/a', {}, { lattice: 'maxNumber' })
    await bl.put('bl:///cells/b', {}, { lattice: 'maxNumber' })
    await bl.put('bl:///cells/sum', {}, { lattice: 'maxNumber' })

    // Set initial values
    await bl.put('bl:///cells/a/value', {}, 3)
    await bl.put('bl:///cells/b/value', {}, 4)

    // Create a sum propagator
    await bl.put(
      'bl:///propagators/add',
      {},
      {
        inputs: ['bl:///cells/a', 'bl:///cells/b'],
        output: 'bl:///cells/sum',
        handler: 'sum',
      }
    )

    // Trigger propagation
    await propagators.onCellChange('bl:///cells/a')

    // Check result
    const result = await bl.get('bl:///cells/sum/value')
    expect(result.body).toBe(7)
  })

  it('propagates changes through chains', async () => {
    // Create cells: a -> double -> quadruple
    // Using duplicate(add) to double: add(x,x) = 2*x
    await bl.put('bl:///cells/a', {}, { lattice: 'maxNumber' })
    await bl.put('bl:///cells/double', {}, { lattice: 'maxNumber' })
    await bl.put('bl:///cells/quadruple', {}, { lattice: 'maxNumber' })

    // Set up propagators - use duplicate combinator with add to double values
    await bl.put(
      'bl:///propagators/double',
      {},
      {
        inputs: ['bl:///cells/a'],
        output: 'bl:///cells/double',
        handler: 'duplicate',
        handlerConfig: { handler: 'add' },
      }
    )

    await bl.put(
      'bl:///propagators/quadruple',
      {},
      {
        inputs: ['bl:///cells/double'],
        output: 'bl:///cells/quadruple',
        handler: 'duplicate',
        handlerConfig: { handler: 'add' },
      }
    )

    // Set initial value
    await bl.put('bl:///cells/a/value', {}, 5)

    // Trigger propagation
    await propagators.onCellChange('bl:///cells/a')

    // Check intermediate (5 + 5 = 10)
    const doubleResult = await bl.get('bl:///cells/double/value')
    expect(doubleResult.body).toBe(10)

    // Check final (10 + 10 = 20)
    const quadResult = await bl.get('bl:///cells/quadruple/value')
    expect(quadResult.body).toBe(20)
  })

  it('handles multiple inputs with reducers', async () => {
    // Create multiple input cells
    await bl.put('bl:///cells/x', {}, { lattice: 'maxNumber' })
    await bl.put('bl:///cells/y', {}, { lattice: 'maxNumber' })
    await bl.put('bl:///cells/z', {}, { lattice: 'maxNumber' })
    await bl.put('bl:///cells/total', {}, { lattice: 'maxNumber' })

    // Set values
    await bl.put('bl:///cells/x/value', {}, 10)
    await bl.put('bl:///cells/y/value', {}, 20)
    await bl.put('bl:///cells/z/value', {}, 30)

    // Create propagator with 3 inputs
    await bl.put(
      'bl:///propagators/total',
      {},
      {
        inputs: ['bl:///cells/x', 'bl:///cells/y', 'bl:///cells/z'],
        output: 'bl:///cells/total',
        handler: 'sum',
      }
    )

    // Trigger
    await propagators.onCellChange('bl:///cells/x')

    const result = await bl.get('bl:///cells/total/value')
    expect(result.body).toBe(60)
  })
})

describe('plumber integration', () => {
  let bl
  let plumber
  let receivedMessages

  beforeEach(() => {
    bl = new Bassline()
    receivedMessages = []

    plumber = createPlumber()
    bl.mount('/plumb', plumber.routes)
    bl._plumber = plumber

    // Listen on a test port
    plumber.listen('test-port', (msg) => {
      receivedMessages.push(msg)
    })
  })

  it('routes messages based on rules', async () => {
    // Add a rule
    plumber.addRule('test-rule', {
      match: { headers: { type: 'test-event' } },
      port: 'test-port',
    })

    // Dispatch a matching message
    plumber.dispatch({
      uri: 'bl:///test',
      headers: { type: 'test-event' },
      body: { data: 'hello' },
    })

    expect(receivedMessages).toHaveLength(1)
    expect(receivedMessages[0].body.data).toBe('hello')
  })

  it('does not route non-matching messages', async () => {
    plumber.addRule('test-rule', {
      match: { headers: { type: 'test-event' } },
      port: 'test-port',
    })

    // Dispatch a non-matching message
    plumber.dispatch({
      uri: 'bl:///test',
      headers: { type: 'other-event' },
      body: { data: 'ignored' },
    })

    expect(receivedMessages).toHaveLength(0)
  })

  it('supports regex matching in rules', async () => {
    plumber.addRule('uri-rule', {
      match: { uri: '^bl:///cells/.*' },
      port: 'test-port',
    })

    plumber.dispatch({
      uri: 'bl:///cells/counter',
      headers: {},
      body: {},
    })

    plumber.dispatch({
      uri: 'bl:///data/something',
      headers: {},
      body: {},
    })

    expect(receivedMessages).toHaveLength(1)
    expect(receivedMessages[0].uri).toBe('bl:///cells/counter')
  })
})
