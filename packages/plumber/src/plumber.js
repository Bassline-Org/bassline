import { routes, matchesPattern } from '@bassline/core'

/**
 * Create a plumber for message routing based on pattern-matched rules
 *
 * Rules are stored as resources at `bl:///plumb/rules/:name`
 * Ports are named destinations for message delivery
 *
 * @returns {Object} Plumber with rule management, routing, and port subscription
 *
 * @example
 * const plumber = createPlumber()
 * bl.install(plumber.routes)
 * bl.tap('put', plumber.createTap())
 *
 * // Add a rule via API
 * bl.put('bl:///plumb/rules/cell-watcher', {}, {
 *   match: { headers: { type: '^cell$' } },
 *   port: 'cell-updates'
 * })
 *
 * // Listen on a port
 * plumber.listen('cell-updates', (msg) => {
 *   console.log('Cell changed:', msg.uri)
 * })
 */
export function createPlumber() {
  /** @type {Map<string, {match: object, port: string}>} */
  const rules = new Map()
  /** @type {Map<string, Set<function>>} */
  const ports = new Map()

  /**
   * Add a routing rule
   * @param {string} name - Rule name
   * @param {{match: object, port: string}} rule - Rule definition
   */
  function addRule(name, rule) {
    rules.set(name, rule)
  }

  /**
   * Remove a routing rule
   * @param {string} name - Rule name
   */
  function removeRule(name) {
    rules.delete(name)
  }

  /**
   * Find all rules that match a message
   * @param {object} message - Message to match against rules
   * @returns {Array<{name: string, rule: object}>}
   */
  function route(message) {
    const matches = []
    for (const [name, rule] of rules) {
      if (matchesPattern(rule.match, message)) {
        matches.push({ name, rule })
      }
    }
    return matches
  }

  /**
   * Subscribe to messages on a port
   * @param {string} port - Port name
   * @param {function} callback - Callback for messages
   * @returns {function} Unsubscribe function
   */
  function listen(port, callback) {
    if (!ports.has(port)) ports.set(port, new Set())
    ports.get(port).add(callback)
    return () => ports.get(port).delete(callback)
  }

  /**
   * Dispatch a message to matching ports
   * @param {object} message - Message to dispatch
   */
  function dispatch(message) {
    const matched = route(message)
    for (const { rule } of matched) {
      const listeners = ports.get(rule.port)
      if (listeners) {
        for (const cb of listeners) {
          cb(message)
        }
      }
    }
  }

  /**
   * Create a tap for automatic message dispatching
   * Install this tap on PUT to automatically route messages
   * @returns {function}
   */
  function createTap() {
    return ({ uri, body, result }) => {
      if (result) {
        dispatch({ uri, ...result })
      }
    }
  }

  const plumbRoutes = routes('/plumb', r => {
    // List all rules
    r.get('/rules', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: [...rules.keys()].map(name => ({
          name,
          type: 'plumb-rule',
          uri: `bl:///plumb/rules/${name}`
        }))
      }
    }))

    // Get/put individual rules
    r.route('/rules/:name', {
      get: ({ params }) => {
        const rule = rules.get(params.name)
        if (!rule) return null
        return {
          headers: { type: 'bl:///types/plumb-rule' },
          body: rule
        }
      },
      put: ({ params, body }) => {
        addRule(params.name, body)
        return {
          headers: { type: 'bl:///types/plumb-rule' },
          body
        }
      }
    })
  })

  /**
   * Install plumber into a Bassline instance
   * Sets up both routes (for rule management) and taps (for message routing)
   * @param {import('@bassline/core').Bassline} bl
   */
  function install(bl) {
    bl.install(plumbRoutes)
    bl.tap('put', createTap())
  }

  return {
    addRule,
    removeRule,
    route,
    listen,
    dispatch,
    createTap,
    routes: plumbRoutes,
    install,
    // Expose internals for debugging
    _rules: rules,
    _ports: ports
  }
}
