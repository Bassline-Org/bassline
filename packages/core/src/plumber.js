import { resource, routes, bind } from './resource.js'

/**
 * Pattern matcher for plumber rules
 */
const match = (pattern, target) => {
  if (pattern === undefined || pattern === null) return true
  if (typeof pattern === 'string') return typeof target === 'string' && new RegExp(pattern).test(target)
  if (typeof pattern !== 'object') return pattern === target
  if (typeof target !== 'object' || target === null) return false
  return Object.keys(pattern).every(k => match(pattern[k], target[k]))
}

/**
 * Create a plumber resource for message routing
 *
 * Routes:
 *   GET  /           → bassline describing plumber
 *   GET  /rules      → list all rules
 *   GET  /rules/:name → get rule
 *   PUT  /rules/:name → set rule { match, to }
 *   PUT  /send       → dispatch message to matching rules via kit
 */
export const createPlumber = () => {
  const rules = new Map()

  return routes({
    '': resource({
      get: async () => ({
        headers: { type: '/types/bassline' },
        body: {
          name: 'plumber',
          description: 'Message routing via pattern matching',
          resources: {
            '/rules': { description: 'Rule management' },
            '/send': { description: 'Dispatch messages' }
          }
        }
      })
    }),

    rules: routes({
      '': resource({
        get: async () => ({
          headers: {},
          body: Object.fromEntries(rules)
        })
      }),
      unknown: bind('name', resource({
        get: async (h) => {
          const rule = rules.get(h.params.name)
          if (!rule) return { headers: { condition: 'not-found' }, body: null }
          return { headers: {}, body: rule }
        },
        put: async (h, body) => {
          rules.set(h.params.name, body)
          return { headers: {}, body }
        }
      }))
    }),

    send: resource({
      put: async (h, msg) => {
        const matched = []
        for (const [name, rule] of rules) {
          if (match(rule.match, msg)) {
            matched.push(name)
            if (rule.to && h.kit) {
              await h.kit.put({ path: rule.to }, msg)
            }
          }
        }
        return { headers: {}, body: { matched } }
      }
    })
  })
}

export default createPlumber
