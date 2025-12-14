import { resource } from '@bassline/core'
import { createInterpreter } from './tcl.js'
import { loadStandardCommands } from './commands.js'
import { loadBasslineCommands } from './bassline.js'

/**
 * Create Tcl evaluator routes.
 *
 * Resource structure:
 * - GET  /eval           → info about the evaluator
 * - PUT  /eval           → evaluate a script
 *
 * @param {object} options - Configuration options
 * @param {import('@bassline/core').Bassline} options.bl - Bassline instance
 * @returns {object} Tcl routes and factory functions
 */
export function createTclRoutes(options = {}) {
  const { bl } = options

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

  const evalResource = resource((r) => {
    r.get('/', () => ({
      headers: { type: 'bl:///types/evaluator' },
      body: {
        language: 'tcl',
        description: 'Tcl interpreter for Bassline scripting',
      },
    }))

    r.put('/', async ({ body }) => {
      if (!body || !body.script) {
        return {
          headers: { status: 400 },
          body: { error: 'Missing script in body' },
        }
      }

      const interp = createConfiguredInterpreter()

      try {
        const result = await interp.run(body.script)
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

  function install(bl, { prefix = '/eval' } = {}) {
    bl.mount(prefix, evalResource)
  }

  return {
    routes: evalResource,
    install,
    createInterpreter: createConfiguredInterpreter,
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
