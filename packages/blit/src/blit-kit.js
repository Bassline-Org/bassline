import { resource, routes, bind } from '@bassline/core/resource'
import { createCells } from '@bassline/core/cells'
import { Runtime, std, list, dictCmd, namespace, info, string, event } from '@bassline/tcl'
import { createSQLiteStore } from './sqlite-store.js'
import { createSQLResource } from './sql-resource.js'
import { createBlitCommands } from './commands.js'

// Task ID counter
let taskIdCounter = 0

/**
 * Default guide content - static documentation about the system.
 * Can be customized per-blit by writing to /guide.
 */
const DEFAULT_GUIDE = {
  overview: 'Bassline: Everything is a resource with get/put. Headers route requests, body carries data.',

  resources: {
    '/': 'Root - lists available resources',
    '/cells': 'Lattice-based state cells (monotonic merge)',
    '/cells/:name': 'Individual cell',
    '/cells/:name/value': 'Cell value (get/put)',
    '/store': 'Key/value storage',
    '/store/:key': 'Individual stored value',
    '/fn': 'Stored functions',
    '/fn/:name': 'Individual function',
    '/tcl/eval': 'Evaluate TCL script (PUT script, returns result)',
    '/sql/query': 'Execute SQL query',
    '/guide': 'This guide (readable and writable)',
    '/log': 'Append-only log (GET entries, PUT to append)',
    '/tasks': 'Background tasks (PUT script to spawn, GET to list)',
    '/tasks/:id': 'Individual task status and result',
  },

  headers: {
    path: 'Resource path (required)',
    type: 'Content type hint: tcl/dict, tcl/list, js/num, js/obj, js/arr, text/plain',
    trust: 'Trust level for capability gating (0.0-1.0)',
  },

  lattices: {
    maxNumber: 'Keeps maximum value',
    minNumber: 'Keeps minimum value',
    setUnion: 'Merges sets (append-only)',
    lww: 'Last-writer-wins with timestamp',
    boolean: 'OR merge (once true, stays true)',
    object: 'Deep merge objects',
  },

  tcl: {
    description: 'PUT TCL code to /tcl/eval to execute scripts. State persists.',
    examples: [
      'bl put {path /tcl/eval} {set x 42}',
      'bl put {path /tcl/eval} {cell create counter -lattice maxNumber}',
      'bl put {path /tcl/eval} {proc greet {name} { return "Hello $name" }}',
    ],
  },

  examples: [
    { description: 'List all resources', method: 'get', headers: { path: '/' } },
    { description: 'Get cell value', method: 'get', headers: { path: '/cells/counter/value' } },
    {
      description: 'Set cell value',
      method: 'put',
      headers: { path: '/cells/counter/value', type: 'js/num' },
      body: 42,
    },
    { description: 'Store data', method: 'put', headers: { path: '/store/config' }, body: { theme: 'dark' } },
    { description: 'Run TCL', method: 'put', headers: { path: '/tcl/eval' }, body: 'expr {2 + 2}' },
  ],
}

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
 * Create a guide resource backed by store with fallback to defaults.
 * GET returns custom guide if set, otherwise DEFAULT_GUIDE.
 * PUT updates the custom guide and fires semantic log event.
 * @param {object} store - Store resource for persistence
 */
const createGuide = store =>
  resource({
    get: async () => {
      const custom = await store.get({ path: '/_guide' })
      const guideData = custom.body ?? DEFAULT_GUIDE
      return {
        headers: { type: '/types/guide' },
        body: guideData,
      }
    },
    put: async (h, body) => {
      await store.put({ path: '/_guide' }, body)

      // Fire semantic log event (fire and forget)
      if (h.kit) {
        h.kit
          .put(
            { path: '/log' },
            {
              event: 'guide:updated',
              timestamp: Date.now(),
              details: { keys: body ? Object.keys(body) : [] },
            }
          )
          .catch(() => {}) // Ignore errors - log listener may not exist
      }

      return { headers: {}, body: 'guide updated' }
    },
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

  const guide = createGuide(store)

  // TCL eval resource
  const tcl = routes({
    eval: resource({
      put: async (h, body) => {
        try {
          const result = await rt.run(body)
          return { headers: { type: 'tcl/result' }, body: result }
        } catch (err) {
          return { headers: { condition: 'error' }, body: { error: err.message } }
        }
      },
    }),
  })

  // Checkpoint resource - calls the checkpoint function
  const checkpointResource = resource({
    put: async () => {
      await checkpointCells()
      checkpointTcl()
      checkpointFn()
      return { headers: {}, body: { checkpointed: true } }
    },
  })

  // Log resource - append-only log with timestamps
  // Stored in _store under _log as an array
  const log = resource({
    get: async h => {
      const result = await store.get({ path: '/_log' })
      const entries = result.body || []
      // Optional filtering by query params
      let filtered = entries
      if (h.since) {
        const since = typeof h.since === 'number' ? h.since : Date.now() - parseInt(h.since) * 1000
        filtered = filtered.filter(e => e.ts >= since)
      }
      if (h.event) {
        filtered = filtered.filter(e => e.event === h.event)
      }
      return { headers: { type: '/types/log' }, body: filtered }
    },
    put: async (h, body) => {
      const entry = {
        ts: Date.now(),
        ...(typeof body === 'object' ? body : { message: body }),
      }
      // Append to log array
      const current = await store.get({ path: '/_log' })
      const entries = current.body || []
      entries.push(entry)
      await store.put({ path: '/_log' }, entries)
      return { headers: { type: '/types/log-entry' }, body: entry }
    },
  })

  // In-memory task registry for this blit
  const taskRegistry = new Map()

  /**
   * Create a fresh TCL runtime with standard libs and bl command.
   * Used for background tasks to avoid proc race conditions.
   * @param kit
   */
  const createTaskRuntime = kit => {
    const taskRt = new Runtime()
    // Register standard TCL libraries
    for (const [name, cmd] of Object.entries(std)) taskRt.register(name, cmd)
    for (const [name, cmd] of Object.entries(list)) taskRt.register(name, cmd)
    for (const [name, cmd] of Object.entries(dictCmd)) taskRt.register(name, cmd)
    for (const [name, cmd] of Object.entries(namespace)) taskRt.register(name, cmd)
    for (const [name, cmd] of Object.entries(info)) taskRt.register(name, cmd)
    for (const [name, cmd] of Object.entries(string)) taskRt.register(name, cmd)
    for (const [name, cmd] of Object.entries(event)) taskRt.register(name, cmd)
    // Register bl command pointing to same kit
    const blitCmds = createBlitCommands(conn, kit)
    for (const [name, cmd] of Object.entries(blitCmds)) taskRt.register(name, cmd)
    return taskRt
  }

  // Tasks resource - spawn background tasks with fresh runtimes
  const tasks = routes({
    '': resource({
      get: async () => {
        // List all tasks
        const taskList = []
        for (const [id, task] of taskRegistry) {
          taskList.push({ id, status: task.status, created: task.created })
        }
        return { headers: { type: '/types/task-list' }, body: taskList }
      },
      put: async (h, body) => {
        // Spawn new task
        const id = `task_${++taskIdCounter}`
        const { script } = typeof body === 'string' ? { script: body } : body
        const created = Date.now()

        // Store task metadata
        const task = { id, status: 'pending', script, created, result: null, error: null }
        taskRegistry.set(id, task)

        // Also persist to store for durability
        await store.put({ path: `/_tasks/${id}` }, task)

        // Log task creation
        await log.put({}, { event: 'task:created', taskId: id })

        // Create reference to kit for closure
        // The kit variable is defined later, so we need to defer
        setTimeout(async () => {
          task.status = 'running'
          task.started = Date.now()
          await store.put({ path: `/_tasks/${id}` }, task)
          await log.put({}, { event: 'task:started', taskId: id })

          try {
            // Create fresh runtime with same kit
            const taskRt = createTaskRuntime(kit)

            // Hydrate procs from _fn so task has access to skills
            const fnResult = conn.query('SELECT key, value FROM _fn')
            for (const row of fnResult.rows) {
              try {
                await taskRt.run(row.value)
              } catch {
                // Skip invalid procs
              }
            }

            // Run the script
            const result = await taskRt.run(script)

            task.status = 'done'
            task.result = result
            task.finished = Date.now()
            await store.put({ path: `/_tasks/${id}` }, task)
            await log.put({}, { event: 'task:done', taskId: id, result })
          } catch (err) {
            task.status = 'error'
            task.error = err.message
            task.finished = Date.now()
            await store.put({ path: `/_tasks/${id}` }, task)
            await log.put({}, { event: 'task:error', taskId: id, error: err.message })
          }
        }, 0)

        return { headers: { type: '/types/task' }, body: { id, status: 'pending' } }
      },
    }),

    // Individual task access
    unknown: bind(
      'id',
      resource({
        get: async h => {
          const task = taskRegistry.get(h.params.id)
          if (task) {
            return { headers: { type: '/types/task' }, body: task }
          }
          // Try loading from store (for persisted tasks)
          const stored = await store.get({ path: `/_tasks/${h.params.id}` })
          if (stored.body) {
            return { headers: { type: '/types/task' }, body: stored.body }
          }
          return { headers: { condition: 'not-found' }, body: null }
        },
      })
    ),
  })

  const kit = routes({
    cells: wrap(cells),
    store: wrap(store),
    fn: wrap(fn),
    sql: wrap(sql),
    tcl: wrap(tcl),
    guide: wrap(guide),
    checkpoint: checkpointResource,
    log: wrap(log),
    tasks: wrap(tasks),

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
