import { resource } from '../resource.js'

/**
 * Create a retry wrapper that retries failed requests with exponential backoff.
 *
 * Ports:
 *   GET  /*     → forward to target with retry
 *   PUT  /*     → forward to target with retry
 *   GET  /stats → { attempts, successes, failures, retries }
 * @param {object} target - The resource to wrap
 * @param {object} opts - Options
 * @param {number} opts.maxAttempts - Max attempts including initial (default: 3)
 * @param {number} opts.baseDelay - Initial delay in ms (default: 100)
 * @param {number} opts.maxDelay - Max delay in ms (default: 5000)
 * @param {number} opts.factor - Backoff multiplier (default: 2)
 * @param {Function} opts.shouldRetry - Custom retry predicate (default: retry on error)
 * @returns {object} A retry resource
 */
export const createRetry = (target, opts = {}) => {
  const {
    maxAttempts = 3,
    baseDelay = 100,
    maxDelay = 5000,
    factor = 2,
    shouldRetry = result => {
      return (
        result.headers?.condition === 'error' ||
        result.headers?.condition === 'unavailable' ||
        result.headers?.status >= 500
      )
    },
  } = opts

  // Stats
  let totalAttempts = 0
  let totalSuccesses = 0
  let totalFailures = 0
  let totalRetries = 0

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

  const getDelay = attempt => {
    const delay = baseDelay * Math.pow(factor, attempt)
    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1)
    return Math.min(delay + jitter, maxDelay)
  }

  const executeWithRetry = async fn => {
    let lastResult
    let lastError

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      totalAttempts++

      if (attempt > 0) {
        totalRetries++
        await sleep(getDelay(attempt - 1))
      }

      try {
        const result = await fn()
        if (!shouldRetry(result)) {
          totalSuccesses++
          return result
        }
        lastResult = result
      } catch (e) {
        lastError = e
      }
    }

    // All attempts exhausted
    totalFailures++

    if (lastError) throw lastError
    return lastResult
  }

  const statsResource = resource({
    get: async () => ({
      headers: {},
      body: {
        attempts: totalAttempts,
        successes: totalSuccesses,
        failures: totalFailures,
        retries: totalRetries,
        config: { maxAttempts, baseDelay, maxDelay, factor },
      },
    }),
  })

  return resource({
    get: async h => {
      if (h.path === '/stats') return statsResource.get(h)
      return executeWithRetry(() => target.get(h))
    },
    put: async (h, b) => {
      if (h.path === '/stats') return statsResource.get(h)
      return executeWithRetry(() => target.put(h, b))
    },
  })
}
