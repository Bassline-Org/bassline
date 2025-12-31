import { resource } from '../resource.js'

/**
 * Create a tracer that logs all requests to a target resource.
 *
 * Ports:
 *   GET  /*       → forward to target, record trace
 *   PUT  /*       → forward to target, record trace
 *   GET  /traces  → list recent traces
 *   PUT  /clear   → clear trace history
 * @param {object} target - The resource to wrap
 * @param {object} opts - Options
 * @param {number} opts.maxTraces - Max traces to keep (default: 100)
 * @param {Function} opts.onTrace - Callback for each trace (optional)
 * @returns {object} A traced resource
 */
export const createTracer = (target, opts = {}) => {
  const { maxTraces = 100, onTrace = null } = opts

  const traces = []

  const record = trace => {
    traces.push(trace)
    if (traces.length > maxTraces) traces.shift()
    if (onTrace) onTrace(trace)
  }

  const tracesResource = resource({
    get: async h => {
      const limit = h.limit || maxTraces
      const filter = h.filter // optional: 'error', 'slow', path pattern

      let result = traces.slice(-limit)

      if (filter === 'error') {
        result = result.filter(t => t.error || t.condition === 'error')
      } else if (filter === 'slow') {
        result = result.filter(t => t.elapsed > 1000)
      } else if (filter) {
        result = result.filter(t => t.path.includes(filter))
      }

      return {
        headers: {},
        body: {
          traces: result,
          total: traces.length,
        },
      }
    },
  })

  const clearResource = resource({
    put: async () => {
      const count = traces.length
      traces.length = 0
      return { headers: {}, body: { cleared: count } }
    },
  })

  return resource({
    get: async h => {
      if (h.path === '/traces') return tracesResource.get(h)

      const start = Date.now()
      const traceId = `${start}-${Math.random().toString(36).slice(2, 8)}`

      try {
        const result = await target.get(h)
        const elapsed = Date.now() - start

        record({
          id: traceId,
          op: 'get',
          path: h.path,
          start,
          elapsed,
          condition: result.headers?.condition || 'ok',
          error: null,
        })

        return result
      } catch (e) {
        const elapsed = Date.now() - start

        record({
          id: traceId,
          op: 'get',
          path: h.path,
          start,
          elapsed,
          condition: 'error',
          error: e.message,
        })

        throw e
      }
    },
    put: async (h, b) => {
      if (h.path === '/traces') return tracesResource.get(h)
      if (h.path === '/clear') return clearResource.put(h, b)

      const start = Date.now()
      const traceId = `${start}-${Math.random().toString(36).slice(2, 8)}`

      try {
        const result = await target.put(h, b)
        const elapsed = Date.now() - start

        record({
          id: traceId,
          op: 'put',
          path: h.path,
          start,
          elapsed,
          condition: result.headers?.condition || 'ok',
          error: null,
          bodySize: JSON.stringify(b || {}).length,
        })

        return result
      } catch (e) {
        const elapsed = Date.now() - start

        record({
          id: traceId,
          op: 'put',
          path: h.path,
          start,
          elapsed,
          condition: 'error',
          error: e.message,
          bodySize: JSON.stringify(b || {}).length,
        })

        throw e
      }
    },
  })
}
