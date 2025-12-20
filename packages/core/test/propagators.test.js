import { describe, it, expect } from 'vitest'
import { createPropagators } from '../src/propagators.js'
import { createMockKit } from './helpers.js'

describe('createPropagators', () => {
  it('lists propagators at root', async () => {
    const propagators = createPropagators()
    const result = await propagators.get({ path: '/' })

    expect(result.headers.type).toBe('/types/bassline')
    expect(result.body.name).toBe('propagators')
  })

  it('creates propagator', async () => {
    const propagators = createPropagators()
    const config = {
      inputs: ['a', 'b'],
      output: '/cells/sum/value',
      fn: '/fn/sum',
    }

    const result = await propagators.put({ path: '/adder' }, config)

    expect(result.body).toEqual(config)
  })

  it('gets propagator by name', async () => {
    const propagators = createPropagators()
    const config = { inputs: ['x'], output: '/output', fn: '/fn/identity' }

    await propagators.put({ path: '/test' }, config)

    const result = await propagators.get({ path: '/test' })
    expect(result.headers.type).toBe('/types/propagator')
    expect(result.body).toEqual(config)
  })

  it('returns not-found for missing propagator', async () => {
    const propagators = createPropagators()
    const result = await propagators.get({ path: '/missing' })

    expect(result.headers.condition).toBe('not-found')
  })

  describe('run', () => {
    it('runs propagator with inputs from kit', async () => {
      const kit = createMockKit({
        '/inputs/a': { headers: {}, body: 10 },
        '/inputs/b': { headers: {}, body: 20 },
        '/fn': { headers: {}, body: (a, b) => a + b },
      })

      const propagators = createPropagators()

      await propagators.put(
        { path: '/adder' },
        {
          inputs: ['a', 'b'],
          output: '/output',
          fn: '/fn/sum',
        }
      )

      const result = await propagators.put({ path: '/adder/run', kit }, null)

      expect(result.body.computed).toBe(true)
      expect(result.body.result).toBe(30)

      // Verify output was written to kit
      const calls = kit.calls()
      const outputCall = calls.find(c => c.headers.path === '/output')
      expect(outputCall).toBeDefined()
      expect(outputCall.body).toBe(30)
    })

    it('returns error without kit', async () => {
      const propagators = createPropagators()

      await propagators.put(
        { path: '/test' },
        {
          inputs: ['x'],
          output: '/output',
          fn: '/fn/identity',
        }
      )

      const result = await propagators.put({ path: '/test/run' }, null)

      expect(result.headers.condition).toBe('error')
      expect(result.headers.message).toBe('no kit')
    })

    it('returns error when fn is not a function', async () => {
      const kit = createMockKit({
        '/inputs/a': { headers: {}, body: 10 },
        '/fn': { headers: {}, body: 'not a function' },
      })

      const propagators = createPropagators()

      await propagators.put(
        { path: '/test' },
        {
          inputs: ['a'],
          output: '/output',
          fn: '/fn/bad',
        }
      )

      const result = await propagators.put({ path: '/test/run', kit }, null)

      expect(result.headers.condition).toBe('error')
      expect(result.headers.message).toContain('not a function')
    })

    it('returns not-found for missing propagator run', async () => {
      const kit = createMockKit()
      const propagators = createPropagators()

      const result = await propagators.put({ path: '/missing/run', kit }, null)

      expect(result.headers.condition).toBe('not-found')
    })
  })
})
