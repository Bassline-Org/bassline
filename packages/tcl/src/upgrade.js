import { resource } from '@bassline/core'
import { createInterpreter } from './tcl.js'
import { loadStandardCommands } from './commands.js'
import { loadBasslineCommands } from './bassline.js'

/**
 * Create Tcl evaluator routes with session support.
 *
 * Resource structure:
 * - GET  /tcl             → list all sessions
 * - GET  /tcl/:id         → get session info
 * - PUT  /tcl/:id         → create session
 * - PUT  /tcl/:id/eval    → evaluate script in session
 * - PUT  /tcl/:id/delete  → delete session
 *
 * Legacy:
 * - GET  /eval            → evaluator info
 * - PUT  /eval            → evaluate in 'default' session
 *
 * @param {object} options - Configuration options
 * @param {import('@bassline/core').Bassline} options.bl - Bassline instance
 * @returns {object} Tcl routes and factory functions
 */
export function createTclRoutes(options = {}) {
  const { bl } = options

  // Session storage: id -> { interp, createdAt, lastUsed }
  const sessions = new Map()

  /**
   * Create a configured interpreter with Bassline commands
   * @returns {object} Configured interpreter
   */
  function createConfiguredInterpreter() {
    const interp = createInterpreter()
    loadStandardCommands(interp)
    loadBasslineCommands(interp, bl)
    return interp
  }

  /**
   * Get or create a session
   */
  function getOrCreateSession(id) {
    if (!sessions.has(id)) {
      sessions.set(id, {
        interp: createConfiguredInterpreter(),
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
      })
    }
    return sessions.get(id)
  }

  // Session-based routes at /tcl
  // NOTE: More specific routes must come before less specific ones
  const tclResource = resource((r) => {
    // List all sessions
    r.get('/', () => {
      const list = Array.from(sessions.entries()).map(([id, s]) => ({
        id,
        createdAt: s.createdAt,
        lastUsed: s.lastUsed,
      }))
      return {
        headers: { type: 'bl:///types/tcl-session-list' },
        body: list,
      }
    })

    // Evaluate in session (must come before /:id)
    r.put('/:id/eval', async ({ params, body }) => {
      if (!body || !body.script) {
        return {
          headers: { status: 400 },
          body: { error: 'Missing script in body' },
        }
      }

      const session = getOrCreateSession(params.id)
      session.lastUsed = new Date().toISOString()

      try {
        const result = await session.interp.run(body.script)
        return {
          headers: { type: 'bl:///types/eval-result' },
          body: { result },
        }
      } catch (err) {
        return {
          headers: { type: 'bl:///types/eval-error', status: 400 },
          body: { error: err.message },
        }
      }
    })

    // Delete session (must come before /:id)
    r.put('/:id/delete', ({ params }) => {
      const existed = sessions.delete(params.id)
      return {
        headers: {},
        body: { deleted: existed },
      }
    })

    // Get session info
    r.get('/:id', ({ params }) => {
      const session = sessions.get(params.id)
      if (!session) {
        return {
          headers: { status: 404 },
          body: { error: 'Session not found' },
        }
      }
      return {
        headers: { type: 'bl:///types/tcl-session' },
        body: {
          id: params.id,
          createdAt: session.createdAt,
          lastUsed: session.lastUsed,
        },
      }
    })

    // Create session
    r.put('/:id', ({ params }) => {
      const existed = sessions.has(params.id)
      const session = getOrCreateSession(params.id)
      return {
        headers: { type: 'bl:///types/tcl-session' },
        body: {
          id: params.id,
          created: !existed,
          createdAt: session.createdAt,
        },
      }
    })
  })

  // Legacy /eval routes for backward compatibility
  const evalResource = resource((r) => {
    r.get('/', () => ({
      headers: { type: 'bl:///types/evaluator' },
      body: {
        language: 'tcl',
        description: 'Tcl interpreter for Bassline scripting',
        sessions: 'Use bl:///tcl/:session/eval for stateful evaluation',
      },
    }))

    // Legacy PUT - uses 'default' session for backward compatibility
    r.put('/', async ({ body }) => {
      if (!body || !body.script) {
        return {
          headers: { status: 400 },
          body: { error: 'Missing script in body' },
        }
      }

      const session = getOrCreateSession('default')
      session.lastUsed = new Date().toISOString()

      try {
        const result = await session.interp.run(body.script)
        return {
          headers: { type: 'bl:///types/eval-result' },
          body: { result },
        }
      } catch (err) {
        return {
          headers: { type: 'bl:///types/eval-error', status: 400 },
          body: { error: err.message },
        }
      }
    })
  })

  function install(bl, { prefix = '/tcl', evalPrefix = '/eval' } = {}) {
    bl.mount(prefix, tclResource)
    bl.mount(evalPrefix, evalResource)
  }

  return {
    routes: tclResource,
    evalRoutes: evalResource,
    install,
    createInterpreter: createConfiguredInterpreter,
    sessions,
  }
}

/**
 * Install Tcl into a Bassline instance.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 */
export default function installTcl(bl) {
  const tcl = createTclRoutes({ bl })
  tcl.install(bl)
  bl.setModule('tcl', tcl)

  console.log('Tcl installed')
}
