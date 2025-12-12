import { describe, it, expect } from 'vitest'
import { Bassline } from '@bassline/core'
import { createPlumber } from '../src/plumber.js'

describe('createPlumber', () => {
  describe('rule management via resources', () => {
    it('adds and retrieves rules via PUT/GET', async () => {
      const bl = new Bassline()
      const plumber = createPlumber()
      plumber.install(bl)

      await bl.put(
        'bl:///plumb/rules/test-rule',
        {},
        {
          match: { source: '^bl:///data/.*' },
          to: 'bl:///handlers/data',
        }
      )

      const result = await bl.get('bl:///plumb/rules/test-rule')
      expect(result.body.match.source).toBe('^bl:///data/.*')
      expect(result.body.to).toBe('bl:///handlers/data')
    })

    it('lists all rules', async () => {
      const bl = new Bassline()
      const plumber = createPlumber()
      plumber.install(bl)

      await bl.put('bl:///plumb/rules/rule-1', {}, { match: { port: 'a' }, to: 'bl:///a' })
      await bl.put('bl:///plumb/rules/rule-2', {}, { match: { port: 'b' }, to: 'bl:///b' })

      const list = await bl.get('bl:///plumb/rules')
      expect(list.body.entries).toHaveLength(2)
      expect(list.body.entries.map((e) => e.name).sort()).toEqual(['rule-1', 'rule-2'])
    })

    it('returns null for non-existent rules', async () => {
      const bl = new Bassline()
      const plumber = createPlumber()
      plumber.install(bl)

      const result = await bl.get('bl:///plumb/rules/missing')
      expect(result).toBeNull()
    })

    it('kills an existing rule', async () => {
      const bl = new Bassline()
      const plumber = createPlumber()
      plumber.install(bl)

      await bl.put('bl:///plumb/rules/test-rule', {}, { match: { port: 'x' }, to: 'bl:///dest' })
      expect(plumber._rules.has('test-rule')).toBe(true)

      const result = await bl.put('bl:///plumb/rules/test-rule/kill', {}, {})
      expect(result.headers.type).toBe('bl:///types/plumb-rule-killed')
      expect(result.body.name).toBe('test-rule')
      expect(result.body.killed).toBe(true)
      expect(plumber._rules.has('test-rule')).toBe(false)
    })

    it('returns killed: false for non-existent rule', async () => {
      const bl = new Bassline()
      const plumber = createPlumber()
      plumber.install(bl)

      const result = await bl.put('bl:///plumb/rules/missing/kill', {}, {})
      expect(result.body.killed).toBe(false)
    })
  })

  describe('routing', () => {
    it('finds matching rules for a message', () => {
      const plumber = createPlumber()
      plumber._rules.set('source-rule', {
        match: { source: '^bl:///data/.*' },
        to: 'bl:///handlers/data',
      })
      plumber._rules.set('port-rule', {
        match: { port: 'cell-updates' },
        to: 'bl:///handlers/cells',
      })

      const sourceMatches = plumber.route({ source: 'bl:///data/users' })
      expect(sourceMatches).toHaveLength(1)
      expect(sourceMatches[0].name).toBe('source-rule')

      const portMatches = plumber.route({ port: 'cell-updates' })
      expect(portMatches).toHaveLength(1)
      expect(portMatches[0].name).toBe('port-rule')
    })

    it('returns multiple matching rules', () => {
      const plumber = createPlumber()
      plumber._rules.set('rule-1', { match: { source: '^bl:///' }, to: 'bl:///a' })
      plumber._rules.set('rule-2', { match: { source: '.*' }, to: 'bl:///b' })

      const matches = plumber.route({ source: 'bl:///anything' })
      expect(matches).toHaveLength(2)
    })

    it('returns empty array when no rules match', () => {
      const plumber = createPlumber()
      plumber._rules.set('specific', { match: { source: '^bl:///data/.*' }, to: 'bl:///a' })

      const matches = plumber.route({ source: 'bl:///other/path' })
      expect(matches).toHaveLength(0)
    })
  })

  describe('send endpoint', () => {
    it('sends messages to matching destinations', async () => {
      const bl = new Bassline()
      const plumber = createPlumber()
      plumber.install(bl)

      // Track what gets PUT to the destination
      const received = []
      bl.route('/destination', {
        put: ({ headers, body }) => {
          received.push({ headers, body })
          return { headers: { type: 'bl:///types/received' }, body }
        },
      })

      // Add a rule
      await bl.put(
        'bl:///plumb/rules/test',
        {},
        {
          match: { port: 'test-port' },
          to: 'bl:///destination',
        }
      )

      // Send a message - routing metadata in headers, payload in body
      const result = await bl.put(
        'bl:///plumb/send',
        { source: 'bl:///cells/counter', port: 'test-port' },
        {
          headers: { type: 'bl:///types/cell-value', custom: 'header' },
          body: { value: 42 },
        }
      )

      expect(result.headers.type).toBe('bl:///types/plumb-sent')
      expect(result.body.sent).toBe(true)
      expect(result.body.matchedRules).toEqual(['test'])
      expect(result.body.destinations).toEqual(['bl:///destination'])

      expect(received).toHaveLength(1)
      expect(received[0].headers.custom).toBe('header')
      expect(received[0].body.value).toBe(42)
    })

    it('sends to multiple matching destinations', async () => {
      const bl = new Bassline()
      const plumber = createPlumber()
      plumber.install(bl)

      const received = { a: [], b: [] }
      bl.route('/dest-a', {
        put: ({ body }) => {
          received.a.push(body)
          return { headers: {}, body }
        },
      })
      bl.route('/dest-b', {
        put: ({ body }) => {
          received.b.push(body)
          return { headers: {}, body }
        },
      })

      await bl.put('bl:///plumb/rules/rule-a', {}, { match: { type: '.*' }, to: 'bl:///dest-a' })
      await bl.put('bl:///plumb/rules/rule-b', {}, { match: { type: '.*' }, to: 'bl:///dest-b' })

      await bl.put(
        'bl:///plumb/send',
        {},
        { headers: { type: 'bl:///types/test' }, body: { data: 'hello' } }
      )

      expect(received.a).toHaveLength(1)
      expect(received.b).toHaveLength(1)
      expect(received.a[0].data).toBe('hello')
      expect(received.b[0].data).toBe('hello')
    })

    it('returns empty results when no rules match', async () => {
      const bl = new Bassline()
      const plumber = createPlumber()
      plumber.install(bl)

      const result = await bl.put(
        'bl:///plumb/send',
        { port: 'no-such-port' },
        { headers: {}, body: {} }
      )

      expect(result.body.matchedRules).toEqual([])
      expect(result.body.destinations).toEqual([])
    })
  })

  describe('message history', () => {
    it('tracks sent messages in history', async () => {
      const bl = new Bassline()
      const plumber = createPlumber()
      plumber.install(bl)

      bl.route('/dest', {
        put: ({ body }) => ({ headers: {}, body }),
      })

      await bl.put('bl:///plumb/rules/test', {}, { match: { port: 'p' }, to: 'bl:///dest' })

      await bl.put(
        'bl:///plumb/send',
        { source: 'bl:///test', port: 'p' },
        { headers: { type: 'bl:///types/test' }, body: {} }
      )

      const history = await bl.get('bl:///plumb/history')
      expect(history.body.entries).toHaveLength(1)
      expect(history.body.entries[0].source).toBe('bl:///test')
      expect(history.body.entries[0].port).toBe('p')
      expect(history.body.entries[0].matchedRules).toEqual(['test'])
    })
  })
})
