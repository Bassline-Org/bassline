import { resource, matchesPattern } from '@bassline/core'

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
  /** @type {Array<object>} - Circular buffer for message history */
  const messageHistory = []
  const MAX_HISTORY = 50
  let messageId = 0

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
    const matchedRules = []
    const dispatchedPorts = []

    for (const { name, rule } of matched) {
      matchedRules.push(name)
      const listeners = ports.get(rule.port)
      if (listeners && listeners.size > 0) {
        dispatchedPorts.push(rule.port)
        for (const cb of listeners) {
          cb(message)
        }
      }
    }

    // Log to history if any rules matched
    if (matchedRules.length > 0) {
      const entry = {
        id: ++messageId,
        timestamp: new Date().toISOString(),
        uri: message.uri,
        type: message.headers?.type,
        matchedRules,
        dispatchedPorts
      }
      messageHistory.push(entry)
      if (messageHistory.length > MAX_HISTORY) {
        messageHistory.shift()
      }

      // Broadcast to plumb-flow port for live visualization
      const flowListeners = ports.get('plumb-flow')
      if (flowListeners && flowListeners.size > 0) {
        for (const cb of flowListeners) {
          cb(entry)
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

  const plumbResource = resource(r => {
    // Get message history for visualization
    r.get('/history', () => ({
      headers: { type: 'bl:///types/plumb-history' },
      body: {
        entries: [...messageHistory],
        count: messageHistory.length,
        maxHistory: MAX_HISTORY
      }
    }))

    // Get plumber state for introspection/visualization
    r.get('/state', () => ({
      headers: { type: 'bl:///types/plumb-state' },
      body: {
        rules: [...rules.entries()].map(([name, rule]) => ({
          name,
          match: rule.match,
          port: rule.port,
          uri: `bl:///plumb/rules/${name}`
        })),
        ports: [...ports.entries()].map(([name, listeners]) => ({
          name,
          listenerCount: listeners.size
        })),
        // Known sources that dispatch to plumber
        sources: [
          { type: 'cells', events: ['cell-value', 'resource-removed', 'contradiction'] },
          { type: 'timers', events: ['timer-tick'] },
          { type: 'fetch', events: ['fetch-response', 'fetch-error'] },
          { type: 'monitors', events: ['monitor-update', 'monitor-error'] },
          { type: 'recipes', events: ['recipe-saved', 'instance-created'] },
          { type: 'propagators', events: ['propagator-fired'] }
        ]
      }
    }))

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
   * @param {object} [options] - Options
   * @param {string} [options.prefix='/plumb'] - Mount prefix
   */
  function install(bl, { prefix = '/plumb' } = {}) {
    bl.mount(prefix, plumbResource)
    bl.tap('put', createTap())
  }

  return {
    addRule,
    removeRule,
    route,
    listen,
    dispatch,
    createTap,
    routes: plumbResource,
    install,
    // Expose internals for debugging
    _rules: rules,
    _ports: ports,
    _messageHistory: messageHistory
  }
}
