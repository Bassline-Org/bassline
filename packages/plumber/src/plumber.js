import { resource, matchesPattern } from '@bassline/core'

/**
 * Well-known plumber ports
 */
export const ports = {
  // Resource lifecycle events
  RESOURCE_CREATED: 'resource-created',
  RESOURCE_UPDATED: 'resource-updated',
  RESOURCE_REMOVED: 'resource-removed',
  RESOURCE_ENABLED: 'resource-enabled',
  RESOURCE_DISABLED: 'resource-disabled',
  // Domain events
  CONTRADICTIONS: 'contradictions',
  TIMER_TICK: 'timer-tick',
  FETCH_RESPONSES: 'fetch-responses',
  FETCH_ERRORS: 'fetch-errors',
  MONITOR_UPDATES: 'monitor-updates',
  MONITOR_ERRORS: 'monitor-errors',
  ROUTE_NOT_FOUND: 'route-not-found',
}

/**
 * Well-known message types
 */
export const types = {
  // Resource lifecycle types
  RESOURCE_CREATED: 'bl:///types/resource-created',
  RESOURCE_UPDATED: 'bl:///types/resource-updated',
  RESOURCE_REMOVED: 'bl:///types/resource-removed',
  RESOURCE_ENABLED: 'bl:///types/resource-enabled',
  RESOURCE_DISABLED: 'bl:///types/resource-disabled',
  // Domain types
  CONTRADICTION: 'bl:///types/contradiction',
  TIMER_TICK: 'bl:///types/timer-tick',
  FETCH_RESPONSE: 'bl:///types/fetch-response',
  FETCH_ERROR: 'bl:///types/fetch-error',
  MONITOR_UPDATE: 'bl:///types/monitor-update',
  MONITOR_ERROR: 'bl:///types/monitor-error',
  ROUTE_NOT_FOUND: 'bl:///types/route-not-found',
}

/**
 * Create a plumber for message routing based on pattern-matched rules
 *
 * Rules are stored as resources at `bl:///plumb/rules/:name`
 * Messages are sent via `PUT bl:///plumb/send`
 * @returns {object} Plumber with rule management and routing
 * @example
 * const plumber = createPlumber()
 * plumber.install(bl)
 *
 * // Add a rule via resource API
 * await bl.put('bl:///plumb/rules/cell-watcher', {}, {
 *   match: { type: 'bl:///types/cell-value' },
 *   to: 'bl:///propagators/on-cell-change'
 * })
 *
 * // Send a message - routing metadata in headers, payload in body
 * await bl.put('bl:///plumb/send',
 *   { source: 'bl:///cells/counter', port: 'cell-updates' },
 *   { headers: { type: 'bl:///types/cell-value' }, body: { value: 42 } }
 * )
 */
export function createPlumber() {
  /** @type {Map<string, {match: object, to: string}>} */
  const rules = new Map()
  /** @type {Array<object>} - Circular buffer for message history */
  const messageHistory = []
  const MAX_HISTORY = 50
  let messageId = 0

  /**
   * Find all rules that match a message
   * @param {object} message - Message to match (source, port, type)
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
   * Send a message through the plumber
   * Finds matching rules and PUTs the payload to each destination
   * @param {object} routingInfo - Routing metadata { source, port, type }
   * @param {object} payload - Message to forward { headers, body }
   * @param {object} bl - Bassline instance
   * @returns {Promise<{matchedRules: string[], destinations: string[]}>}
   */
  async function send(routingInfo, payload, bl) {
    const matched = route(routingInfo)
    const matchedRules = []
    const destinations = []

    for (const { name, rule } of matched) {
      matchedRules.push(name)
      if (rule.to) {
        destinations.push(rule.to)
        await bl.put(rule.to, payload.headers || {}, payload.body)
      }
    }

    // Log to history
    if (matchedRules.length > 0) {
      const entry = {
        id: ++messageId,
        timestamp: new Date().toISOString(),
        source: routingInfo.source,
        port: routingInfo.port,
        type: routingInfo.type,
        matchedRules,
        destinations,
      }
      messageHistory.push(entry)
      if (messageHistory.length > MAX_HISTORY) {
        messageHistory.shift()
      }
    }

    return { matchedRules, destinations }
  }

  const plumbResource = resource((r) => {
    // Send a message through the plumber
    // Routing metadata in request headers (source, port)
    // Payload to forward in body ({ headers, body })
    r.put('/send', async ({ headers, body, bl }) => {
      const routingInfo = {
        source: headers.source,
        port: headers.port,
        type: body.headers?.type,
      }
      const result = await send(routingInfo, body, bl)
      return {
        headers: { type: 'bl:///types/plumb-sent' },
        body: {
          sent: true,
          matchedRules: result.matchedRules,
          destinations: result.destinations,
        },
      }
    })

    // Get message history for visualization
    r.get('/history', () => ({
      headers: { type: 'bl:///types/plumb-history' },
      body: {
        entries: [...messageHistory],
        count: messageHistory.length,
        maxHistory: MAX_HISTORY,
      },
    }))

    // Get plumber state for introspection/visualization
    r.get('/state', () => ({
      headers: { type: 'bl:///types/plumb-state' },
      body: {
        rules: [...rules.entries()].map(([name, rule]) => ({
          name,
          match: rule.match,
          to: rule.to,
          uri: `bl:///plumb/rules/${name}`,
        })),
        // Known sources that dispatch to plumber
        sources: [
          {
            type: 'cells',
            events: [
              'resource-created',
              'resource-updated',
              'resource-removed',
              'cell-updates',
              'contradiction',
            ],
          },
          {
            type: 'propagators',
            events: ['resource-created', 'resource-updated', 'resource-removed'],
          },
          {
            type: 'timers',
            events: [
              'resource-created',
              'resource-updated',
              'resource-removed',
              'resource-enabled',
              'resource-disabled',
              'timer-tick',
            ],
          },
          {
            type: 'monitors',
            events: [
              'resource-created',
              'resource-updated',
              'resource-removed',
              'resource-enabled',
              'resource-disabled',
              'monitor-update',
              'monitor-error',
            ],
          },
          { type: 'fetch', events: ['fetch-response', 'fetch-error'] },
          { type: 'recipes', events: ['recipe-saved', 'instance-created'] },
        ],
      },
    }))

    // List all rules
    r.get('/rules', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: [...rules.keys()].map((name) => ({
          name,
          type: 'plumb-rule',
          uri: `bl:///plumb/rules/${name}`,
        })),
      },
    }))

    // Get/put individual rules
    r.route('/rules/:name', {
      get: ({ params }) => {
        const rule = rules.get(params.name)
        if (!rule) return null
        return {
          headers: { type: 'bl:///types/plumb-rule' },
          body: rule,
        }
      },
      put: ({ params, body }) => {
        rules.set(params.name, body)
        return {
          headers: { type: 'bl:///types/plumb-rule' },
          body,
        }
      },
    })

    // Kill (remove) a rule
    r.put('/rules/:name/kill', ({ params }) => {
      const name = params.name
      const existed = rules.has(name)
      if (existed) {
        rules.delete(name)
      }
      return {
        headers: { type: 'bl:///types/plumb-rule-killed' },
        body: { name, killed: existed },
      }
    })
  })

  /**
   * Install plumber into a Bassline instance
   * Sets up routes for rule management and /send endpoint
   * @param {import('@bassline/core').Bassline} bl
   * @param {object} [options] - Options
   * @param {string} [options.prefix] - Mount prefix
   */
  function install(bl, { prefix = '/plumb' } = {}) {
    bl.mount(prefix, plumbResource)
  }

  return {
    route,
    send,
    routes: plumbResource,
    install,
    // Expose internals for debugging/testing
    _rules: rules,
    _messageHistory: messageHistory,
  }
}
