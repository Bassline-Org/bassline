import { resource, routes } from '@bassline/core/resource'
import { createCells } from '@bassline/core/cells'
import { createSQLiteStore } from './sqlite-store.js'

/**
 * Wrap a resource to make it readonly.
 * GET operations work normally, PUT operations return a readonly error.
 * @param target
 */
const readonly = target =>
  resource({
    get: async h => target.get(h),
    put: async () => ({ headers: { condition: 'readonly' }, body: null }),
  })

/**
 * Create a kit for a blit - routes to SQLite-backed stores.
 *
 * Routes:
 * /cells/*   → in-memory cells (hydrated from _cells on load)
 * /store/*   → SQLite _store table
 * /fn/*      → SQLite _fn table
 * /changed   → forwards to parent kit (or no-op)
 * /condition, /announce, /verify → delegate to parent
 * unknown    → delegate to parent kit
 * @param {object} conn - SQLite connection
 * @param {object} parentKit - Parent kit for delegation (optional)
 * @param {object} options - Options
 * @param {boolean} options.readonly - Make kit readonly (GET only)
 * @returns {object} { kit, cells, hydrate, checkpoint }
 */
export const createBlitKit = (conn, parentKit = null, options = {}) => {
  const cells = createCells()
  const store = createSQLiteStore(conn, '_store')
  const fn = createSQLiteStore(conn, '_fn')

  // Delegate to parent kit (or return not-found)
  const delegate = resource({
    get: async h => {
      if (!parentKit) return { headers: { condition: 'not-found' }, body: null }
      return parentKit.get({ ...h, path: '/' + h.segment + h.path })
    },
    put: async (h, body) => {
      if (!parentKit) return { headers: { condition: 'not-found' }, body: null }
      return parentKit.put({ ...h, path: '/' + h.segment + h.path }, body)
    },
  })

  // Apply readonly wrapper if requested
  const wrap = options.readonly ? readonly : r => r

  const kit = routes({
    cells: wrap(cells),
    store: wrap(store),
    fn: wrap(fn),

    // Semantic paths delegate to parent
    changed: delegate,
    condition: delegate,
    announce: delegate,
    verify: delegate,

    // Everything else delegates up
    unknown: delegate,
  })

  /**
   * Hydrate cells from _cells table.
   * Call this on blit load to restore cell state.
   */
  const hydrate = async () => {
    const result = conn.query('SELECT key, lattice, value FROM _cells')
    for (const row of result.rows) {
      // Create the cell with its lattice
      await cells.put({ path: `/${row.key}` }, { lattice: row.lattice })
      // Set its value if present
      if (row.value) {
        try {
          const value = JSON.parse(row.value)
          await cells.put({ path: `/${row.key}/value` }, value)
        } catch {
          // If value isn't valid JSON, skip it
        }
      }
    }
  }

  /**
   * Checkpoint cells to _cells table.
   * Call this to persist current cell state.
   * Handles both additions/updates and deletions.
   */
  const checkpoint = async () => {
    // Get list of cells
    const cellList = await cells.get({ path: '/' })
    const currentCells = new Set()

    if (cellList.body?.resources) {
      for (const path of Object.keys(cellList.body.resources)) {
        const name = path.slice(1) // Remove leading /
        currentCells.add(name)
        const cellData = await cells.get({ path: `/${name}` })
        if (cellData.body) {
          conn.execute(
            `INSERT INTO _cells (key, lattice, value) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET lattice = excluded.lattice, value = excluded.value`,
            [name, cellData.body.lattice, JSON.stringify(cellData.body.value)]
          )
        }
      }
    }

    // Delete cells that no longer exist
    const stored = conn.query('SELECT key FROM _cells')
    for (const row of stored.rows) {
      if (!currentCells.has(row.key)) {
        conn.execute('DELETE FROM _cells WHERE key = ?', [row.key])
      }
    }
  }

  return { kit, cells, hydrate, checkpoint }
}
