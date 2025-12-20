import { resource, routes, bind } from '@bassline/core/resource'
import { createSQLiteConnection } from '@bassline/database'
import { Runtime, std, list, dictCmd } from '@bassline/tcl'
import { createBlitKit } from './blit-kit.js'
import { initSchema } from './schema.js'
import { createBlitCommands } from './commands.js'

/**
 * Create a blit loader/manager resource.
 *
 * Routes:
 *   GET  /              → list loaded blits
 *   PUT  /:name         → load blit { path: '/path/to/file.blit' }
 *   GET  /:name         → blit info
 *   PUT  /:name/checkpoint → save cell state to SQLite
 *   PUT  /:name/close   → close blit
 *   GET  /:name/*       → forward to blit's kit
 *   PUT  /:name/*       → forward to blit's kit
 */
export const createBlits = () => {
  const blits = new Map()

  /**
   * Load a blit from a SQLite file.
   * @param {string} name - Blit name
   * @param {string} filePath - Path to SQLite file
   * @param {object} parentKit - Parent kit for delegation
   * @param {object} options - Load options
   * @param {boolean} options.force - Force re-run boot even if initialized
   * @param {boolean} options.readonly - Load blit in readonly mode (GET only)
   */
  const loadBlit = async (name, filePath, parentKit, options = {}) => {
    // Open SQLite connection with WAL mode
    const conn = createSQLiteConnection({ path: filePath })

    // Ensure schema tables exist
    initSchema(conn)

    // Create kit for this blit
    const { kit, _cells, hydrate, checkpoint } = createBlitKit(conn, parentKit, {
      readonly: options.readonly,
    })

    // Hydrate cells from stored state
    await hydrate()

    // Check initialization status
    const initResult = conn.query("SELECT value FROM _boot WHERE key = '_initialized'")
    const isInitialized = initResult.rows.length > 0
    const shouldRunBoot = !isInitialized || options.force

    // Check for boot script
    const bootResult = conn.query("SELECT value FROM _boot WHERE key = 'init.tcl'")

    let bootOutput = null
    if (bootResult.rows.length > 0 && shouldRunBoot) {
      const script = bootResult.rows[0].value

      // Create TCL runtime
      const rt = new Runtime()

      // Register standard libraries
      for (const [n, fn] of Object.entries(std)) rt.register(n, fn)
      for (const [n, fn] of Object.entries(list)) rt.register(n, fn)
      for (const [n, fn] of Object.entries(dictCmd)) rt.register(n, fn)

      // Register blit-specific commands (all access via kit, not direct refs)
      const blitCommands = createBlitCommands(conn, kit)
      for (const [n, fn] of Object.entries(blitCommands)) rt.register(n, fn)

      // Run boot script (runtime now handles async commands)
      try {
        bootOutput = await rt.run(script)
        // Mark as initialized on successful boot
        conn.execute(
          `INSERT INTO _boot (key, value) VALUES ('_initialized', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          [new Date().toISOString()]
        )
      } catch (err) {
        bootOutput = { error: err.message }
      }
    } else if (isInitialized && !options.force) {
      bootOutput = { skipped: true, reason: 'already initialized' }
    }

    return { conn, kit, checkpoint, bootOutput }
  }

  return routes({
    '': resource({
      get: async () => ({
        headers: { type: '/types/bassline' },
        body: {
          name: 'blits',
          description: 'Frozen resource loader',
          resources: Object.fromEntries([...blits.keys()].map(name => [`/${name}`, {}])),
        },
      }),
    }),

    unknown: bind(
      'name',
      routes({
        '': resource({
          get: async h => {
            const blit = blits.get(h.params.name)
            if (!blit) return { headers: { condition: 'not-found' }, body: null }

            return {
              headers: { type: '/types/blit' },
              body: {
                name: h.params.name,
                path: blit.path,
                loaded: true,
                bootOutput: blit.bootOutput,
              },
            }
          },

          put: async (h, body) => {
            const { path, force, readonly } = body

            // Close existing if reloading
            if (blits.has(h.params.name)) {
              const existing = blits.get(h.params.name)
              await existing.checkpoint()
              existing.conn.close()
            }

            const { conn, kit, checkpoint, bootOutput } = await loadBlit(h.params.name, path, h.kit, {
              force: !!force,
              readonly: !!readonly,
            })

            blits.set(h.params.name, { path, conn, kit, checkpoint, bootOutput })

            return {
              headers: { type: '/types/blit' },
              body: { name: h.params.name, path, loaded: true, bootOutput },
            }
          },
        }),

        checkpoint: resource({
          put: async h => {
            const blit = blits.get(h.params.name)
            if (!blit) return { headers: { condition: 'not-found' }, body: null }

            await blit.checkpoint()
            return { headers: {}, body: { checkpointed: true } }
          },
        }),

        close: resource({
          put: async h => {
            const blit = blits.get(h.params.name)
            if (!blit) return { headers: { condition: 'not-found' }, body: null }

            await blit.checkpoint()
            blit.conn.close()
            blits.delete(h.params.name)

            return { headers: {}, body: { closed: true } }
          },
        }),

        // Forward everything else to the blit's kit
        unknown: resource({
          get: async h => {
            const blit = blits.get(h.params.name)
            if (!blit) return { headers: { condition: 'not-found' }, body: null }

            // Forward: /myapp/cells/counter → blit.kit.get('/cells/counter')
            return blit.kit.get({ ...h, path: h.path })
          },
          put: async (h, body) => {
            const blit = blits.get(h.params.name)
            if (!blit) return { headers: { condition: 'not-found' }, body: null }

            return blit.kit.put({ ...h, path: h.path }, body)
          },
        }),
      })
    ),
  })
}
