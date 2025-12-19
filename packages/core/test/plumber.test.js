import { describe, it, expect } from 'vitest'
import { createPlumber } from '../src/plumber.js'
import { createMockKit } from './helpers.js'

describe('createPlumber', () => {
  it('lists plumber at root', async () => {
    const plumber = createPlumber()
    const result = await plumber.get({ path: '/' })

    expect(result.headers.type).toBe('/types/bassline')
    expect(result.body.name).toBe('plumber')
  })

  it('lists rules (initially empty)', async () => {
    const plumber = createPlumber()
    const result = await plumber.get({ path: '/rules' })

    expect(result.body).toEqual({})
  })

  it('creates rule', async () => {
    const plumber = createPlumber()
    const rule = { match: { type: 'user' }, to: '/cells/users' }

    const result = await plumber.put({ path: '/rules/user-rule' }, rule)

    expect(result.body).toEqual(rule)
  })

  it('gets rule by name', async () => {
    const plumber = createPlumber()
    const rule = { match: { type: 'event' }, to: '/events' }

    await plumber.put({ path: '/rules/event-rule' }, rule)

    const result = await plumber.get({ path: '/rules/event-rule' })
    expect(result.body).toEqual(rule)
  })

  it('returns not-found for missing rule', async () => {
    const plumber = createPlumber()
    const result = await plumber.get({ path: '/rules/missing' })

    expect(result.headers.condition).toBe('not-found')
  })

  it('lists all rules', async () => {
    const plumber = createPlumber()

    await plumber.put({ path: '/rules/rule1' }, { match: {}, to: '/a' })
    await plumber.put({ path: '/rules/rule2' }, { match: {}, to: '/b' })

    const result = await plumber.get({ path: '/rules' })
    expect(result.body).toHaveProperty('rule1')
    expect(result.body).toHaveProperty('rule2')
  })

  describe('send', () => {
    it('returns empty matched array when no rules', async () => {
      const plumber = createPlumber()
      const result = await plumber.put({ path: '/send' }, { test: 'data' })

      expect(result.body.matched).toEqual([])
    })

    it('matches rule and dispatches via kit', async () => {
      const kit = createMockKit()
      const plumber = createPlumber()

      await plumber.put(
        { path: '/rules/test' },
        { match: { type: 'greeting' }, to: '/cells/greetings/value' }
      )

      const result = await plumber.put(
        { path: '/send', kit },
        { type: 'greeting', message: 'hello' }
      )

      expect(result.body.matched).toContain('test')

      const calls = kit.calls()
      expect(calls.length).toBe(1)
      expect(calls[0].headers.path).toBe('/cells/greetings/value')
      expect(calls[0].body.message).toBe('hello')
    })

    it('matches multiple rules', async () => {
      const kit = createMockKit()
      const plumber = createPlumber()

      await plumber.put({ path: '/rules/r1' }, { match: {}, to: '/a' })
      await plumber.put({ path: '/rules/r2' }, { match: {}, to: '/b' })

      const result = await plumber.put(
        { path: '/send', kit },
        { data: 'test' }
      )

      expect(result.body.matched.length).toBe(2)
      expect(kit.calls().length).toBe(2)
    })

    it('does not dispatch when rule has no to path', async () => {
      const kit = createMockKit()
      const plumber = createPlumber()

      await plumber.put({ path: '/rules/log' }, { match: {} })

      const result = await plumber.put(
        { path: '/send', kit },
        { data: 'test' }
      )

      expect(result.body.matched).toContain('log')
      expect(kit.calls().length).toBe(0)
    })

    it('works without kit', async () => {
      const plumber = createPlumber()

      await plumber.put({ path: '/rules/r1' }, { match: {}, to: '/a' })

      // Should not throw
      const result = await plumber.put({ path: '/send' }, { data: 'test' })
      expect(result.body.matched).toContain('r1')
    })
  })

  describe('pattern matching', () => {
    it('matches empty pattern to anything', async () => {
      const plumber = createPlumber()
      await plumber.put({ path: '/rules/all' }, { match: {} })

      const result = await plumber.put({ path: '/send' }, { any: 'data' })
      expect(result.body.matched).toContain('all')
    })

    it('matches null/undefined pattern to anything', async () => {
      const plumber = createPlumber()
      await plumber.put({ path: '/rules/all' }, { match: null })

      const result = await plumber.put({ path: '/send' }, { any: 'data' })
      expect(result.body.matched).toContain('all')
    })

    it('matches exact values', async () => {
      const plumber = createPlumber()
      // Note: patterns are treated as regex, so use ^ and $ for exact match
      await plumber.put({ path: '/rules/exact' }, { match: { status: '^active$' } })

      const r1 = await plumber.put({ path: '/send' }, { status: 'active' })
      expect(r1.body.matched).toContain('exact')

      const r2 = await plumber.put({ path: '/send' }, { status: 'inactive' })
      expect(r2.body.matched).not.toContain('exact')
    })

    it('matches nested objects', async () => {
      const plumber = createPlumber()
      await plumber.put(
        { path: '/rules/nested' },
        { match: { user: { role: 'admin' } } }
      )

      const r1 = await plumber.put(
        { path: '/send' },
        { user: { role: 'admin', name: 'Alice' } }
      )
      expect(r1.body.matched).toContain('nested')

      const r2 = await plumber.put(
        { path: '/send' },
        { user: { role: 'user', name: 'Bob' } }
      )
      expect(r2.body.matched).not.toContain('nested')
    })

    it('matches regex patterns for strings', async () => {
      const plumber = createPlumber()
      await plumber.put(
        { path: '/rules/regex' },
        { match: { email: '@example\\.com$' } }
      )

      const r1 = await plumber.put(
        { path: '/send' },
        { email: 'test@example.com' }
      )
      expect(r1.body.matched).toContain('regex')

      const r2 = await plumber.put(
        { path: '/send' },
        { email: 'test@other.com' }
      )
      expect(r2.body.matched).not.toContain('regex')
    })

    it('does not match primitives against objects', async () => {
      const plumber = createPlumber()
      await plumber.put(
        { path: '/rules/obj' },
        { match: { data: { nested: true } } }
      )

      const result = await plumber.put({ path: '/send' }, { data: 'string' })
      expect(result.body.matched).not.toContain('obj')
    })
  })
})
