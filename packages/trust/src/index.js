import { resource } from '@bassline/core'
import { trustEstimate } from './lattices.js'

/**
 * Create trust system routes and middleware
 *
 * Routes:
 * - GET  /trust/peers           - List known peers
 * - GET  /trust/peers/:id       - Get trust info for peer
 * - PUT  /trust/observe         - Record an observation
 * - GET  /trust/thresholds      - Get capability thresholds
 * - PUT  /trust/thresholds      - Set capability thresholds
 *
 * @param {Object} options
 * @param {Object} [options.thresholds] - Capability thresholds { read: 0.2, write: 0.5, install: 0.8 }
 * @param {number} [options.sampleRate=0.1] - Fraction of requests to sample for verification
 * @returns {{ routes: import('@bassline/core').RouterBuilder, middleware: Function, checkCapability: Function, observe: Function }}
 */
export function createTrustSystem(options = {}) {
  // In-memory peer trust store
  // In a real system, this would be backed by cells
  /** @type {Map<string, import('./lattices.js').TrustEstimate>} */
  const peers = new Map()

  // Capability thresholds
  let thresholds = {
    read: 0.2,    // Low bar for reading
    write: 0.5,   // Medium bar for writing
    install: 0.8, // High bar for installing code
    ...options.thresholds
  }

  const sampleRate = options.sampleRate ?? 0.1

  /**
   * Get trust for a peer, creating initial if not exists
   */
  function getTrust(peerId) {
    if (!peers.has(peerId)) {
      peers.set(peerId, trustEstimate.initial())
    }
    return peers.get(peerId)
  }

  /**
   * Record an observation for a peer
   * @param {string} peerId - Peer identifier
   * @param {number} outcome - 1 for positive, 0 for negative
   */
  function observe(peerId, outcome) {
    const current = getTrust(peerId)
    const updated = trustEstimate.observe(current, outcome)
    peers.set(peerId, updated)
    return updated
  }

  /**
   * Check if a peer can perform a capability
   * @param {string} peerId - Peer identifier
   * @param {string} capability - Capability name (read, write, install)
   * @returns {boolean}
   */
  function checkCapability(peerId, capability) {
    // Anonymous/local requests always allowed
    if (!peerId) return true

    const threshold = thresholds[capability]
    if (threshold === undefined) return true // Unknown capability = allow

    const trust = getTrust(peerId)
    return trustEstimate.meetsThreshold(trust, threshold)
  }

  /**
   * Middleware for capability gating
   * Checks trust before allowing requests through
   */
  function middleware(ctx, next) {
    const peer = ctx.headers?.peer

    // Determine required capability based on verb and URI
    let capability = 'read'
    if (ctx.verb === 'put') {
      capability = ctx.uri?.includes('/install/') ? 'install' : 'write'
    }

    // Check capability
    if (!checkCapability(peer, capability)) {
      return {
        headers: { type: 'bl:///types/error', error: 'insufficient-trust' },
        body: {
          message: `Peer ${peer} lacks trust for ${capability}`,
          required: thresholds[capability],
          current: peer ? getTrust(peer).value : null
        }
      }
    }

    // Random sampling for verification (non-blocking)
    if (peer && Math.random() < sampleRate) {
      // Could do async verification here and record outcome later
      // For now, just record that we saw them (neutral observation)
    }

    return next()
  }

  // Build routes
  const trustResource = resource(r => {
    // List all known peers
    r.get('/peers', () => ({
      headers: { type: 'bl:///types/list' },
      body: {
        entries: [...peers.entries()].map(([id, trust]) => ({
          id,
          ...trust,
          confidence: trustEstimate.confidenceInterval(trust)
        }))
      }
    }))

    // Get trust for specific peer
    r.get('/peers/:id', ({ params }) => {
      const trust = getTrust(params.id)
      return {
        headers: { type: 'bl:///types/trust' },
        body: {
          id: params.id,
          ...trust,
          confidence: trustEstimate.confidenceInterval(trust),
          capabilities: {
            read: trustEstimate.meetsThreshold(trust, thresholds.read),
            write: trustEstimate.meetsThreshold(trust, thresholds.write),
            install: trustEstimate.meetsThreshold(trust, thresholds.install)
          }
        }
      }
    })

    // Record an observation
    r.put('/observe', ({ body }) => {
      const { peer, outcome } = body
      if (!peer || outcome === undefined) {
        return {
          headers: { type: 'bl:///types/error' },
          body: { message: 'peer and outcome required' }
        }
      }
      const updated = observe(peer, outcome)
      return {
        headers: { type: 'bl:///types/trust' },
        body: { peer, ...updated }
      }
    })

    // Get thresholds
    r.get('/thresholds', () => ({
      headers: { type: 'bl:///types/config' },
      body: thresholds
    }))

    // Set thresholds
    r.put('/thresholds', ({ body }) => {
      thresholds = { ...thresholds, ...body }
      return {
        headers: { type: 'bl:///types/config' },
        body: thresholds
      }
    })
  })

  /**
   * Install trust routes into a Bassline instance
   * @param {import('@bassline/core').Bassline} bl
   * @param {object} [options] - Options
   * @param {string} [options.prefix='/trust'] - Mount prefix
   */
  function install(bl, { prefix = '/trust' } = {}) {
    bl.mount(prefix, trustResource)
  }

  return {
    routes: trustResource,
    install,
    middleware,
    checkCapability,
    observe,
    getTrust
  }
}

export { trustEstimate } from './lattices.js'
