import { resource } from '@bassline/core'
import { FuzzyCell } from './fuzzy.js'
import {
  createKnowledgeCompactor,
  createDedupeCompactor,
  createTimeWindowCompactor,
  createSlidingWindowCompactor
} from './compactors.js'

/**
 * Create routes for fuzzy cells.
 *
 * Routes:
 * - GET  /fuzzy           - List all fuzzy cells
 * - GET  /fuzzy/:name     - Get cell info and accumulated state
 * - PUT  /fuzzy/:name     - Create/configure cell
 * - PUT  /fuzzy/:name/value  - Accumulate a value
 * - PUT  /fuzzy/:name/compact - Force compaction
 * - PUT  /fuzzy/:name/kill    - Delete cell
 *
 * @param {object} options
 * @param {import('@bassline/core').Bassline} options.bl - Bassline instance
 */
export function createFuzzyCellRoutes(options = {}) {
  const { bl } = options
  const store = new Map()  // name → FuzzyCell

  /**
   * Get a compactor function by name
   */
  function getCompactor(type, cellOptions = {}) {
    switch (type) {
      case 'knowledge':
        if (!bl._claude) {
          console.warn('Fuzzy cell: knowledge compactor requires Claude service')
          return null
        }
        return createKnowledgeCompactor(bl, cellOptions)

      case 'dedupe':
        return createDedupeCompactor(cellOptions)

      case 'timeWindow':
        return createTimeWindowCompactor(cellOptions)

      case 'slidingWindow':
        return createSlidingWindowCompactor(cellOptions)

      case 'none':
      case null:
      case undefined:
        return null

      default:
        console.warn(`Fuzzy cell: unknown compactor type "${type}"`)
        return null
    }
  }

  const fuzzyCellResource = resource(r => {
    // List all fuzzy cells
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: [...store.keys()].map(name => ({
          name,
          uri: `bl:///fuzzy/${name}`,
          stats: store.get(name).stats
        }))
      }
    }))

    // Get fuzzy cell info
    r.get('/:name', ({ params }) => {
      const cell = store.get(params.name)
      if (!cell) return null
      return {
        headers: { type: 'bl:///types/fuzzy-cell' },
        body: cell.read()
      }
    })

    // Create/configure fuzzy cell
    r.put('/:name', ({ params, body }) => {
      const {
        compactor = 'knowledge',
        compactThreshold,
        compactProbability,
        minCompactInterval,
        ...compactorOptions
      } = body

      const compactorFn = getCompactor(compactor, compactorOptions)

      const cellOptions = { compactor: compactorFn }
      if (compactThreshold !== undefined) cellOptions.compactThreshold = compactThreshold
      if (compactProbability !== undefined) cellOptions.compactProbability = compactProbability
      if (minCompactInterval !== undefined) cellOptions.minCompactInterval = minCompactInterval

      const cell = new FuzzyCell(cellOptions)
      store.set(params.name, cell)

      return {
        headers: { type: 'bl:///types/fuzzy-cell' },
        body: cell.read()
      }
    })

    // Write to fuzzy cell (accumulate)
    r.put('/:name/value', async ({ params, body }) => {
      let cell = store.get(params.name)
      if (!cell) {
        // Auto-create with default knowledge compactor if Claude available
        const compactorFn = bl._claude ? createKnowledgeCompactor(bl) : null
        cell = new FuzzyCell({ compactor: compactorFn })
        store.set(params.name, cell)
      }

      const result = await cell.write(body)
      return {
        headers: { type: 'bl:///types/fuzzy-cell-value' },
        body: result
      }
    })

    // Force compaction
    r.put('/:name/compact', async ({ params }) => {
      const cell = store.get(params.name)
      if (!cell) return null

      const result = await cell.compact()
      return {
        headers: { type: 'bl:///types/compact-result' },
        body: result
      }
    })

    // Delete fuzzy cell
    r.put('/:name/kill', ({ params }) => {
      const existed = store.delete(params.name)
      return {
        headers: { type: 'bl:///types/resource-removed' },
        body: { removed: existed, uri: `bl:///fuzzy/${params.name}` }
      }
    })
  })

  return {
    routes: fuzzyCellResource,
    /**
     * Install fuzzy cell routes into Bassline
     * @param {import('@bassline/core').Bassline} bl
     * @param {object} [options] - Options
     * @param {string} [options.prefix='/fuzzy'] - Mount prefix
     */
    install: (bl, { prefix = '/fuzzy' } = {}) => bl.mount(prefix, fuzzyCellResource),
    /** Access to the internal store for testing */
    _store: store,
    /** Create a compactor by name */
    getCompactor
  }
}
