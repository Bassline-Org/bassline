import { resource, routes } from '@bassline/core/resource'
import { createCells } from '@bassline/core/cells'
import { Runtime, std, list, dictCmd, namespace, info, string, event } from '@bassline/tcl'
import { createSQLiteStore } from './sqlite-store.js'
import { createSQLResource } from './sql-resource.js'

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
 * @returns {object} { kit, cells, rt, hydrate, checkpoint }
 */
export const createBlitKit = (conn, parentKit = null, options = {}) => {
  const cells = createCells()
  const store = createSQLiteStore(conn, '_store')
  const fn = createSQLiteStore(conn, '_fn')
  const sql = createSQLResource(conn)

  // Create TCL runtime for this blit
  const rt = new Runtime()

  // Register standard TCL libraries
  for (const [name, cmd] of Object.entries(std)) rt.register(name, cmd)
  for (const [name, cmd] of Object.entries(list)) rt.register(name, cmd)
  for (const [name, cmd] of Object.entries(dictCmd)) rt.register(name, cmd)
  for (const [name, cmd] of Object.entries(namespace)) rt.register(name, cmd)
  for (const [name, cmd] of Object.entries(info)) rt.register(name, cmd)
  for (const [name, cmd] of Object.entries(string)) rt.register(name, cmd)
  for (const [name, cmd] of Object.entries(event)) rt.register(name, cmd)

  // Delegate to parent kit (or return not-found)
  // For known semantic paths, we need to reconstruct the full path
  const createDelegate = segment =>
    resource({
      get: async h => {
        if (!parentKit) return { headers: { condition: 'not-found' }, body: null }
        // Reconstruct full path: /segment + remaining path
        return parentKit.get({ ...h, path: '/' + segment + h.path })
      },
      put: async (h, body) => {
        if (!parentKit) return { headers: { condition: 'not-found' }, body: null }
        return parentKit.put({ ...h, path: '/' + segment + h.path }, body)
      },
    })

  // For unknown paths, the original path is passed unchanged by routes()
  const unknownDelegate = resource({
    get: async h => {
      if (!parentKit) return { headers: { condition: 'not-found' }, body: null }
      return parentKit.get(h)
    },
    put: async (h, body) => {
      if (!parentKit) return { headers: { condition: 'not-found' }, body: null }
      return parentKit.put(h, body)
    },
  })

  // Apply readonly wrapper if requested
  const wrap = options.readonly ? readonly : r => r

  const kit = routes({
    cells: wrap(cells),
    store: wrap(store),
    fn: wrap(fn),
    sql: wrap(sql),

    // Semantic paths delegate to parent (need to reconstruct path)
    changed: createDelegate('changed'),
    condition: createDelegate('condition'),
    announce: createDelegate('announce'),
    verify: createDelegate('verify'),

    // Everything else delegates up (routes passes original path)
    unknown: unknownDelegate,
  })

  /**
   * Hydrate cells from _cells table.
   * Call this on blit load to restore cell state.
   */
  const hydrateCells = async () => {
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
   * Hydrate TCL runtime state from _ns table.
   */
  const hydrateTcl = () => {
    const result = conn.query(`SELECT state FROM _ns WHERE id = 'root'`)
    if (result.rows.length > 0) {
      try {
        const data = JSON.parse(result.rows[0].state)
        rt.fromJSON(data)
      } catch {
        // If state isn't valid JSON, skip it
      }
    }
  }

  /**
   * Hydrate procs from _fn table.
   * Procs are stored as TCL source and re-evaluated.
   */
  const hydrateFn = async () => {
    const result = conn.query('SELECT key, value FROM _fn')
    for (const row of result.rows) {
      try {
        // value is proc source: "proc name {params} {body}"
        await rt.run(row.value)
      } catch {
        // Skip invalid proc definitions
      }
    }
  }

  /**
   * Hydrate all state from SQLite.
   * Call this on blit load to restore state.
   */
  const hydrate = async () => {
    await hydrateCells()
    hydrateTcl()
    await hydrateFn()
  }

  /**
   * Checkpoint cells to _cells table.
   * Call this to persist current cell state.
   * Handles both additions/updates and deletions.
   */
  const checkpointCells = async () => {
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

  /**
   * Checkpoint TCL runtime state to _ns table.
   */
  const checkpointTcl = () => {
    const state = JSON.stringify(rt.toJSON())
    conn.execute(
      `INSERT INTO _ns (id, state) VALUES ('root', ?)
       ON CONFLICT(id) DO UPDATE SET state = excluded.state`,
      [state]
    )
  }

  /**
   * Checkpoint procs to _fn table.
   * Collects all user-defined procs and stores their source.
   */
  const checkpointFn = () => {
    // Collect all procs from all namespaces
    const collectProcs = (ns, path = '') => {
      const procs = []
      for (const [name, cmd] of ns.commands) {
        if (cmd._isProc) {
          const fullName = path ? `${path}/${name}` : name
          const params = cmd._params.join(' ')
          const source = `proc ${fullName} {${params}} {${cmd._body}}`
          procs.push({ name: fullName, source })
        }
      }
      for (const [childName, child] of ns.children) {
        // Skip temporary proc namespaces
        if (childName.startsWith('_proc_')) continue
        const childPath = path ? `${path}/${childName}` : childName
        procs.push(...collectProcs(child, childPath))
      }
      return procs
    }

    const procs = collectProcs(rt.root)

    // Clear and re-insert (simpler than diffing)
    conn.execute('DELETE FROM _fn')
    for (const { name, source } of procs) {
      conn.execute('INSERT INTO _fn (key, value) VALUES (?, ?)', [name, source])
    }
  }

  /**
   * Checkpoint all state to SQLite.
   * Call this to persist current state.
   */
  const checkpoint = async () => {
    await checkpointCells()
    checkpointTcl()
    checkpointFn()
  }

  return { kit, cells, rt, hydrate, checkpoint }
}
