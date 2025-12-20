/**
 * Bassline-specific commands for the Tcl interpreter.
 *
 * These connect the scripting language to Bassline's resource model.
 */

/**
 * Create Bassline commands bound to a Bassline instance.
 * @param {object} bl - Bassline instance
 * @returns {object} Commands for Bassline interaction
 */
export function createBasslineCommands(bl) {
  return {
    /**
     * GET a resource.
     *
     * Usage:
     *   get <uri>
     *   get <uri> <headers>
     *
     * Args are JSON strings.
     *
     * Examples:
     *   get bl:///cells/counter
     *   get bl:///cells/counter {\"include\":\"value\"}
     */
    async get(args) {
      if (args.length === 0) {
        throw new Error('get: requires a URI')
      }

      const uri = args[0]
      const headers = args[1] ? JSON.parse(args[1]) : {}

      const result = await bl.get(uri, headers)
      if (result === null) {
        return ''
      }

      // Return full response as JSON
      return JSON.stringify(result)
    },

    /**
     * PUT to a resource.
     *
     * Usage:
     *   put <uri> <body>
     *   put <uri> <body> <headers>
     *
     * Body and headers are JSON strings.
     *
     * Examples:
     *   put bl:///cells/counter/value {\"value\":42}
     *   put bl:///cells/counter {\"lattice\":\"maxNumber\"} {\"type\":\"create\"}
     */
    async put(args) {
      if (args.length < 2) {
        throw new Error('put: requires URI and body')
      }

      const uri = args[0]
      const body = JSON.parse(args[1])
      const headers = args[2] ? JSON.parse(args[2]) : {}

      const result = await bl.put(uri, headers, body)
      if (result === null) {
        return ''
      }

      // Return full response as JSON
      return JSON.stringify(result)
    },

    /**
     * Construct a URI.
     *
     * Usage:
     *   uri <parts...>
     *
     * Joins parts with / and ensures bl:/// prefix.
     *
     * Examples:
     *   uri bl:///cells/counter
     *   uri cells counter
     *   uri $base value
     */
    uri(args) {
      if (args.length === 0) {
        throw new Error('uri: requires at least one part')
      }

      // If first arg already has scheme, use it as base
      let result
      if (args[0].includes('://')) {
        result = args[0]
        for (let i = 1; i < args.length; i++) {
          result = result.replace(/\/$/, '') + '/' + args[i].replace(/^\//, '')
        }
      } else {
        // Join all parts and add bl:/// prefix
        const path = args.map(p => p.replace(/^\/|\/$/g, '')).join('/')
        result = `bl:///${path}`
      }

      return result
    },
  }
}

/**
 * Load Bassline commands into an interpreter.
 * @param {object} interp - Interpreter instance
 * @param {object} bl - Bassline instance
 */
export function loadBasslineCommands(interp, bl) {
  const commands = createBasslineCommands(bl)

  for (const [name, fn] of Object.entries(commands)) {
    interp.register(name, fn)
  }
}
