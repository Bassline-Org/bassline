import { resource } from '../resource.js'

/**
 * Create a rate limiter using token bucket algorithm.
 *
 * Ports:
 *   GET  /*     → forward to target if tokens available
 *   PUT  /*     → forward to target if tokens available
 *   GET  /quota → { tokens, capacity, refillRate, ... }
 * @param {object} target - The resource to wrap
 * @param {object} opts - Options
 * @param {number} opts.capacity - Max tokens in bucket (default: 10)
 * @param {number} opts.refillRate - Tokens added per second (default: 1)
 * @param {number} opts.tokensPerRequest - Tokens consumed per request (default: 1)
 * @returns {object} A rate limited resource
 */
export const createLimiter = (target, opts = {}) => {
  const { capacity = 10, refillRate = 1, tokensPerRequest = 1 } = opts

  // Token bucket state
  let tokens = capacity
  let lastRefill = Date.now()

  // Stats
  let totalRequests = 0
  let totalAllowed = 0
  let totalRejected = 0

  const refill = () => {
    const now = Date.now()
    const elapsed = (now - lastRefill) / 1000 // seconds
    const newTokens = elapsed * refillRate
    tokens = Math.min(capacity, tokens + newTokens)
    lastRefill = now
  }

  const tryConsume = () => {
    refill()
    if (tokens >= tokensPerRequest) {
      tokens -= tokensPerRequest
      return true
    }
    return false
  }

  const quotaResource = resource({
    get: async () => ({
      headers: {},
      body: {
        tokens: Math.floor(tokens),
        capacity,
        refillRate,
        tokensPerRequest,
        stats: {
          totalRequests,
          allowed: totalAllowed,
          rejected: totalRejected,
        },
      },
    }),
  })

  const rateLimitedResponse = () => ({
    headers: {
      condition: 'rate-limited',
      'retry-after': Math.ceil(tokensPerRequest / refillRate),
    },
    body: {
      error: 'rate limit exceeded',
      retryAfter: Math.ceil(tokensPerRequest / refillRate),
    },
  })

  return resource({
    get: async h => {
      if (h.path === '/quota') return quotaResource.get(h)

      totalRequests++
      if (!tryConsume()) {
        totalRejected++
        return rateLimitedResponse()
      }
      totalAllowed++
      return target.get(h)
    },
    put: async (h, b) => {
      if (h.path === '/quota') return quotaResource.get(h)

      totalRequests++
      if (!tryConsume()) {
        totalRejected++
        return rateLimitedResponse()
      }
      totalAllowed++
      return target.put(h, b)
    },
  })
}
