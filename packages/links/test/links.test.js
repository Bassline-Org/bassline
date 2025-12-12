import { describe, it, expect } from 'vitest'
import { Bassline } from '@bassline/core'
import { createLinkIndex, collectRefs } from '../src/links.js'

describe('collectRefs', () => {
  it('extracts bl:// URIs from strings', () => {
    const refs = collectRefs({ type: 'bl:///types/cell', name: 'counter' })
    expect(refs).toEqual(['bl:///types/cell'])
  })

  it('extracts $ref markers', () => {
    const refs = collectRefs({ type: { $ref: 'bl:///types/cell' } })
    // Note: ref is collected twice - once via $ref marker, once via string walk
    expect(refs).toContain('bl:///types/cell')
  })

  it('extracts refs recursively', () => {
    const refs = collectRefs({
      nested: {
        deep: { type: 'bl:///types/a' },
        array: [{ ref: 'bl:///types/b' }],
      },
    })
    expect(refs).toContain('bl:///types/a')
    expect(refs).toContain('bl:///types/b')
  })
})

describe('createLinkIndex', () => {
  describe('indexing', () => {
    it('indexes forward refs', () => {
      const links = createLinkIndex()
      links.index('bl:///cells/counter', { type: 'bl:///types/cell' })

      expect(links.getFrom('bl:///cells/counter')).toEqual(['bl:///types/cell'])
    })

    it('indexes backlinks', () => {
      const links = createLinkIndex()
      links.index('bl:///cells/counter', { type: 'bl:///types/cell' })

      expect(links.getTo('bl:///types/cell')).toEqual(['bl:///cells/counter'])
    })

    it('updates links on re-index', () => {
      const links = createLinkIndex()
      links.index('bl:///cells/counter', { type: 'bl:///types/cell' })
      links.index('bl:///cells/counter', { type: 'bl:///types/number' })

      expect(links.getFrom('bl:///cells/counter')).toEqual(['bl:///types/number'])
      expect(links.getTo('bl:///types/cell')).toEqual([])
    })
  })

  describe('routes', () => {
    it('queries forward refs via /from/:uri', async () => {
      const bl = new Bassline()
      const links = createLinkIndex()
      links.install(bl)

      links.index('bl:///cells/counter', { type: 'bl:///types/cell' })

      const result = await bl.get('bl:///links/from/cells/counter')
      expect(result.body.refs).toEqual(['bl:///types/cell'])
    })

    it('queries backlinks via /to/:uri', async () => {
      const bl = new Bassline()
      const links = createLinkIndex()
      links.install(bl)

      links.index('bl:///cells/counter', { type: 'bl:///types/cell' })

      const result = await bl.get('bl:///links/to/types/cell')
      expect(result.body.refs).toEqual(['bl:///cells/counter'])
    })
  })

  describe('list endpoints', () => {
    it('lists all sources via /from', async () => {
      const bl = new Bassline()
      const links = createLinkIndex()
      links.install(bl)

      links.index('bl:///cells/a', { type: 'bl:///types/cell' })
      links.index('bl:///cells/b', { type: 'bl:///types/cell' })

      const result = await bl.get('bl:///links/from')
      expect(result.body.entries).toHaveLength(2)
      expect(result.body.entries.map((e) => e.uri).sort()).toEqual([
        'bl:///cells/a',
        'bl:///cells/b',
      ])
    })

    it('lists all targets via /to', async () => {
      const bl = new Bassline()
      const links = createLinkIndex()
      links.install(bl)

      links.index('bl:///cells/a', { type: 'bl:///types/cell' })
      links.index('bl:///cells/b', { ref: 'bl:///types/number' })

      const result = await bl.get('bl:///links/to')
      expect(result.body.entries).toHaveLength(2)
      expect(result.body.entries.map((e) => e.uri).sort()).toEqual([
        'bl:///types/cell',
        'bl:///types/number',
      ])
    })

    it('includes ref counts in list results', async () => {
      const bl = new Bassline()
      const links = createLinkIndex()
      links.install(bl)

      links.index('bl:///cells/a', { type: 'bl:///types/cell', other: 'bl:///types/number' })

      const result = await bl.get('bl:///links/from')
      const entry = result.body.entries.find((e) => e.uri === 'bl:///cells/a')
      expect(entry.refCount).toBe(2)
    })
  })

  describe('query endpoint', () => {
    it('returns all links with no filter', async () => {
      const bl = new Bassline()
      const links = createLinkIndex()
      links.install(bl)

      links.index('bl:///cells/a', { type: 'bl:///types/cell' })
      links.index('bl:///cells/b', { type: 'bl:///types/number' })

      const result = await bl.get('bl:///links/query', {})
      expect(result.body.links).toHaveLength(2)
    })

    it('filters by from pattern', async () => {
      const bl = new Bassline()
      const links = createLinkIndex()
      links.install(bl)

      links.index('bl:///cells/counter', { type: 'bl:///types/cell' })
      links.index('bl:///data/users', { type: 'bl:///types/collection' })

      const result = await bl.get('bl:///links/query', { from: '^bl:///cells/.*' })
      expect(result.body.links).toHaveLength(1)
      expect(result.body.links[0].from).toBe('bl:///cells/counter')
    })

    it('filters by to pattern', async () => {
      const bl = new Bassline()
      const links = createLinkIndex()
      links.install(bl)

      links.index('bl:///cells/a', { type: 'bl:///types/cell' })
      links.index('bl:///cells/b', { type: 'bl:///types/number' })

      const result = await bl.get('bl:///links/query', { to: 'types/cell' })
      expect(result.body.links).toHaveLength(1)
      expect(result.body.links[0].to).toBe('bl:///types/cell')
    })

    it('filters by both from and to patterns', async () => {
      const bl = new Bassline()
      const links = createLinkIndex()
      links.install(bl)

      links.index('bl:///cells/a', { type: 'bl:///types/cell' })
      links.index('bl:///cells/b', { type: 'bl:///types/number' })
      links.index('bl:///data/x', { type: 'bl:///types/cell' })

      const result = await bl.get('bl:///links/query', {
        from: '^bl:///cells/.*',
        to: 'types/cell',
      })
      expect(result.body.links).toHaveLength(1)
      expect(result.body.links[0].from).toBe('bl:///cells/a')
      expect(result.body.links[0].to).toBe('bl:///types/cell')
    })

    it('returns count in query results', async () => {
      const bl = new Bassline()
      const links = createLinkIndex()
      links.install(bl)

      links.index('bl:///cells/a', { type: 'bl:///types/cell' })
      links.index('bl:///cells/b', { type: 'bl:///types/cell' })

      const result = await bl.get('bl:///links/query', { to: 'types/cell' })
      expect(result.body.count).toBe(2)
    })
  })
})
