import { resource } from '../resource.js'

/**
 * Create a circuit breaker that wraps a target resource.
 *
 * States:
 *   closed  - Normal operation, requests pass through
 *   open    - Failing, requests return fallback immediately
 *   half-open - Testing, one request allowed through
 *
 * Ports:
 *   GET  /*        → forward to target (or fallback if open)
 *   PUT  /*        → forward to target (or fallback if open)
 *   GET  /state    → { state, failures, lastFailure, ... }
 *   PUT  /reset    → reset to closed state
 * @param {object} target - The resource to wrap
 * @param {object} opts - Options
 * @param {number} opts.threshold - Failures before opening (default: 5)
 * @param {number} opts.resetTimeout - Ms before trying half-open (default: 30000)
 * @param {Function} opts.fallback - Fallback response when open
 * @returns {object} A circuit breaker resource
 */
export const createBreaker = (target, opts = {}) => {
  const {
    threshold = 5,
    resetTimeout = 30000,
    fallback = () => ({ headers: { condition: 'unavailable' }, body: { error: 'circuit open' } }),
  } = opts

  // State
  let state = 'closed' // closed, open, half-open
  let failures = 0
  let successes = 0
  let lastFailure = null
  let openedAt = null

  const shouldTryRequest = () => {
    if (state === 'closed') return true
    if (state === 'half-open') return true
    if (state === 'open') {
      // Check if enough time has passed to try half-open
      if (Date.now() - openedAt >= resetTimeout) {
        state = 'half-open'
        return true
      }
      return false
    }
    return false
  }

  const recordSuccess = () => {
    failures = 0
    successes++
    if (state === 'half-open') {
      state = 'closed'
      openedAt = null
    }
  }

  const recordFailure = () => {
    failures++
    lastFailure = Date.now()
    successes = 0

    if (state === 'half-open') {
      // Failed during test, back to open
      state = 'open'
      openedAt = Date.now()
    } else if (failures >= threshold) {
      state = 'open'
      openedAt = Date.now()
    }
  }

  const isFailure = result => {
    return (
      result.headers?.condition === 'error' ||
      result.headers?.condition === 'unavailable' ||
      result.headers?.status >= 500
    )
  }

  const stateResource = resource({
    get: async () => ({
      headers: {},
      body: {
        state,
        failures,
        successes,
        threshold,
        lastFailure,
        openedAt,
        resetTimeout,
      },
    }),
  })

  const resetResource = resource({
    put: async () => {
      state = 'closed'
      failures = 0
      successes = 0
      lastFailure = null
      openedAt = null
      return { headers: {}, body: { reset: true } }
    },
  })

  const proxyResource = resource({
    get: async h => {
      // Handle internal routes
      if (h.path === '/state') return stateResource.get(h)

      if (!shouldTryRequest()) {
        return typeof fallback === 'function' ? fallback(h) : fallback
      }

      try {
        const result = await target.get(h)
        if (isFailure(result)) {
          recordFailure()
        } else {
          recordSuccess()
        }
        return result
      } catch (e) {
        recordFailure()
        throw e
      }
    },
    put: async (h, b) => {
      // Handle internal routes
      if (h.path === '/state') return stateResource.get(h)
      if (h.path === '/reset') return resetResource.put(h, b)

      if (!shouldTryRequest()) {
        return typeof fallback === 'function' ? fallback(h) : fallback
      }

      try {
        const result = await target.put(h, b)
        if (isFailure(result)) {
          recordFailure()
        } else {
          recordSuccess()
        }
        return result
      } catch (e) {
        recordFailure()
        throw e
      }
    },
  })

  return proxyResource
}
