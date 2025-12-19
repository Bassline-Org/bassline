import { resource, routes, bind } from '@bassline/core'
import { trustEstimate } from './lattices.js'

/**
 * Create trust system resource
 *
 * Routes:
 *   GET  /peers           → list known peers
 *   GET  /peers/:id       → get trust info for peer
 *   PUT  /observe         → record an observation
 *   GET  /thresholds      → get capability thresholds
 *   PUT  /thresholds      → set capability thresholds
 *
 * @param {object} options
 * @param {object} [options.thresholds] - { read: 0.2, write: 0.5, install: 0.8 }
 */
export function createTrust(options = {}) {
  const peers = new Map()

  let thresholds = {
    read: 0.2,
    write: 0.5,
    install: 0.8,
    ...options.thresholds
  }

  function getTrust(peerId) {
    if (!peers.has(peerId)) {
      peers.set(peerId, trustEstimate.initial())
    }
    return peers.get(peerId)
  }

  function observe(peerId, outcome) {
    const current = getTrust(peerId)
    const updated = trustEstimate.observe(current, outcome)
    peers.set(peerId, updated)
    return updated
  }

  function checkCapability(peerId, capability) {
    if (!peerId) return true
    const threshold = thresholds[capability]
    if (threshold === undefined) return true
    const trust = getTrust(peerId)
    return trustEstimate.meetsThreshold(trust, threshold)
  }

  const trustRoutes = routes({
    '': resource({
      get: async () => ({
        headers: { type: '/types/trust-service' },
        body: {
          name: 'trust',
          description: 'Local trust computation and capability gating',
          resources: {
            '/peers': {},
            '/thresholds': {},
            '/observe': { method: 'PUT' }
          }
        }
      })
    }),

    peers: routes({
      '': resource({
        get: async () => ({
          headers: { type: '/types/bassline' },
          body: {
            name: 'peers',
            resources: Object.fromEntries(
              [...peers.entries()].map(([id, trust]) => [
                `/${id}`,
                { ...trust, confidence: trustEstimate.confidenceInterval(trust) }
              ])
            )
          }
        })
      }),

      unknown: bind('id', resource({
        get: async (h) => {
          const trust = getTrust(h.params.id)
          return {
            headers: { type: '/types/trust' },
            body: {
              id: h.params.id,
              ...trust,
              confidence: trustEstimate.confidenceInterval(trust),
              capabilities: {
                read: trustEstimate.meetsThreshold(trust, thresholds.read),
                write: trustEstimate.meetsThreshold(trust, thresholds.write),
                install: trustEstimate.meetsThreshold(trust, thresholds.install)
              }
            }
          }
        }
      }))
    }),

    observe: resource({
      put: async (h, body) => {
        const { peer, outcome } = body
        if (!peer || outcome === undefined) {
          return {
            headers: { condition: 'invalid', message: 'peer and outcome required' },
            body: null
          }
        }
        const updated = observe(peer, outcome)
        return {
          headers: { type: '/types/trust' },
          body: { peer, ...updated }
        }
      }
    }),

    thresholds: resource({
      get: async () => ({
        headers: { type: '/types/config' },
        body: thresholds
      }),

      put: async (h, body) => {
        thresholds = { ...thresholds, ...body }
        return {
          headers: { type: '/types/config' },
          body: thresholds
        }
      }
    })
  })

  // Expose helpers for middleware use
  trustRoutes.checkCapability = checkCapability
  trustRoutes.observe = observe
  trustRoutes.getTrust = getTrust

  return trustRoutes
}

export { trustEstimate } from './lattices.js'
export default createTrust
