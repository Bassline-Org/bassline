import { createTrustSystem } from './index.js'

/**
 * Install trust system into Bassline
 *
 * Usage:
 * ```javascript
 * await bl.put('bl:///install/trust', {}, {
 * path: './packages/trust/src/upgrade.js',
 * sampleRate: 0.1,
 * thresholds: { read: 0.2, write: 0.5, install: 0.8 }
 * })
 * ```
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} config - Configuration
 * @param {number} [config.sampleRate] - Fraction of requests to sample
 * @param {object} [config.thresholds] - Capability thresholds
 * @param {number} [config.middlewarePriority] - Priority for trust middleware
 */
export default function installTrust(bl, config = {}) {
  const trust = createTrustSystem({
    sampleRate: config.sampleRate,
    thresholds: config.thresholds,
  })

  // Install routes
  bl.install(trust.routes)

  // Install middleware with configurable priority
  const uninstallMiddleware = bl.use(trust.middleware, {
    priority: config.middlewarePriority ?? 20,
    id: 'trust',
  })

  // Register for late binding
  const trustModule = {
    checkCapability: trust.checkCapability,
    observe: trust.observe,
    getTrust: trust.getTrust,
    uninstall: uninstallMiddleware,
  }
  bl.setModule('trust', trustModule)
}
