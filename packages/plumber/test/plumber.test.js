import { describe, it, expect } from 'vitest'
import { Bassline } from '@bassline/core'
import { createPlumber } from '../src/plumber.js'

describe('createPlumber', () => {
  describe('rule management', () => {
    it('adds and retrieves rules', () => {
      const plumber = createPlumber()
      plumber.addRule('test-rule', {
        match: { uri: '^bl:///data/.*' },
        port: 'test-port',
      })

      const rule = plumber._rules.get('test-rule')
      expect(rule.match.uri).toBe('^bl:///data/.*')
      expect(rule.port).toBe('test-port')
    })

    it('removes rules', () => {
      const plumber = createPlumber()
      plumber.addRule('test-rule', { match: {}, port: 'test' })
      plumber.removeRule('test-rule')

      expect(plumber._rules.has('test-rule')).toBe(false)
    })
  })

  describe('routing', () => {
    it('finds matching rules for a message', () => {
      const plumber = createPlumber()
      plumber.addRule('data-rule', {
        match: { uri: '^bl:///data/.*' },
        port: 'data-port',
      })
      plumber.addRule('cell-rule', {
        match: { headers: { type: '^cell$' } },
        port: 'cell-port',
      })

      const dataMatches = plumber.route({ uri: 'bl:///data/users' })
      expect(dataMatches).toHaveLength(1)
      expect(dataMatches[0].name).toBe('data-rule')

      const cellMatches = plumber.route({ headers: { type: 'cell' } })
      expect(cellMatches).toHaveLength(1)
      expect(cellMatches[0].name).toBe('cell-rule')
    })

    it('returns multiple matching rules', () => {
      const plumber = createPlumber()
      plumber.addRule('rule-1', {
        match: { uri: '^bl:///' },
        port: 'port-1',
      })
      plumber.addRule('rule-2', {
        match: { uri: '.*' },
        port: 'port-2',
      })

      const matches = plumber.route({ uri: 'bl:///anything' })
      expect(matches).toHaveLength(2)
    })

    it('returns empty array when no rules match', () => {
      const plumber = createPlumber()
      plumber.addRule('specific', {
        match: { uri: '^bl:///data/.*' },
        port: 'data',
      })

      const matches = plumber.route({ uri: 'bl:///other/path' })
      expect(matches).toHaveLength(0)
    })
  })

  describe('ports and listeners', () => {
    it('dispatches messages to listeners on matching ports', () => {
      const plumber = createPlumber()
      plumber.addRule('test', {
        match: { uri: '.*' },
        port: 'test-port',
      })

      const received = []
      plumber.listen('test-port', (msg) => received.push(msg))

      plumber.dispatch({ uri: 'bl:///anything', body: 42 })

      expect(received).toHaveLength(1)
      expect(received[0].uri).toBe('bl:///anything')
      expect(received[0].body).toBe(42)
    })

    it('supports multiple listeners on same port', () => {
      const plumber = createPlumber()
      plumber.addRule('test', { match: { uri: '.*' }, port: 'port' })

      const received1 = []
      const received2 = []
      plumber.listen('port', (msg) => received1.push(msg))
      plumber.listen('port', (msg) => received2.push(msg))

      plumber.dispatch({ uri: 'bl:///test' })

      expect(received1).toHaveLength(1)
      expect(received2).toHaveLength(1)
    })

    it('returns unsubscribe function', () => {
      const plumber = createPlumber()
      plumber.addRule('test', { match: { uri: '.*' }, port: 'port' })

      const received = []
      const unsubscribe = plumber.listen('port', (msg) => received.push(msg))

      plumber.dispatch({ uri: 'bl:///first' })
      unsubscribe()
      plumber.dispatch({ uri: 'bl:///second' })

      expect(received).toHaveLength(1)
      expect(received[0].uri).toBe('bl:///first')
    })
  })

  describe('integration with Bassline', () => {
    it('provides routes for rule management', async () => {
      const bl = new Bassline()
      const plumber = createPlumber()
      plumber.install(bl)

      // Add a rule via PUT
      await bl.put(
        'bl:///plumb/rules/test-rule',
        {},
        {
          match: { uri: '^bl:///data/.*' },
          port: 'data-port',
        }
      )

      // Retrieve the rule via GET
      const result = await bl.get('bl:///plumb/rules/test-rule')
      expect(result.body.match.uri).toBe('^bl:///data/.*')
      expect(result.body.port).toBe('data-port')

      // List all rules
      const list = await bl.get('bl:///plumb/rules')
      expect(list.body.entries).toHaveLength(1)
      expect(list.body.entries[0].name).toBe('test-rule')
    })

    it('dispatches via tap on PUT', async () => {
      const bl = new Bassline()
      const plumber = createPlumber()
      plumber.install(bl)

      // Add a rule that matches anything
      plumber.addRule('all', {
        match: { uri: '.*' },
        port: 'all-changes',
      })

      // Add a route to PUT to
      bl.route('/data/:key', {
        put: ({ body }) => ({
          headers: { type: 'data' },
          body,
        }),
      })

      // Listen on the port
      const received = []
      plumber.listen('all-changes', (msg) => received.push(msg))

      // PUT should trigger the tap which dispatches to the port
      await bl.put('bl:///data/test', {}, { value: 42 })

      expect(received).toHaveLength(1)
      expect(received[0].uri).toBe('bl:///data/test')
      expect(received[0].headers.type).toBe('data')
      expect(received[0].body.value).toBe(42)
    })

    it('returns null for non-existent rules', async () => {
      const bl = new Bassline()
      const plumber = createPlumber()
      plumber.install(bl)

      const result = await bl.get('bl:///plumb/rules/missing')
      expect(result).toBeNull()
    })
  })
})
