import { describe, it, expect } from 'vitest'
import { resource } from '../src/resource.js'
import { createBreaker, createRetry, createLimiter, createTracer } from '../src/patterns/index.js'

describe('createBreaker', () => {
  it('passes requests through when closed', async () => {
    const target = resource({
      get: async () => ({ headers: {}, body: { ok: true } }),
    })

    const breaker = createBreaker(target)

    const result = await breaker.get({ path: '/test' })
    expect(result.body).toEqual({ ok: true })

    const state = await breaker.get({ path: '/state' })
    expect(state.body.state).toBe('closed')
    expect(state.body.successes).toBe(1)
  })

  it('opens after threshold failures', async () => {
    let callCount = 0
    const target = resource({
      get: async () => {
        callCount++
        return { headers: { condition: 'error' }, body: { error: 'fail' } }
      },
    })

    const breaker = createBreaker(target, { threshold: 3 })

    // First 3 failures
    await breaker.get({ path: '/test' })
    await breaker.get({ path: '/test' })
    await breaker.get({ path: '/test' })

    // Should be open now
    const state = await breaker.get({ path: '/state' })
    expect(state.body.state).toBe('open')
    expect(state.body.failures).toBe(3)

    // Next request should return fallback without calling target
    const beforeCount = callCount
    const result = await breaker.get({ path: '/test' })
    expect(result.headers.condition).toBe('unavailable')
    expect(callCount).toBe(beforeCount) // Target not called
  })

  it('transitions to half-open after timeout', async () => {
    let shouldFail = true
    const target = resource({
      get: async () => {
        if (shouldFail) {
          return { headers: { condition: 'error' }, body: null }
        }
        return { headers: {}, body: { ok: true } }
      },
    })

    const breaker = createBreaker(target, { threshold: 1, resetTimeout: 50 })

    // Trigger open
    await breaker.get({ path: '/test' })
    let state = await breaker.get({ path: '/state' })
    expect(state.body.state).toBe('open')

    // Wait for reset timeout
    await new Promise(r => setTimeout(r, 60))

    // Next request should be allowed (half-open)
    shouldFail = false
    const result = await breaker.get({ path: '/test' })
    expect(result.body).toEqual({ ok: true })

    // Should be closed again
    state = await breaker.get({ path: '/state' })
    expect(state.body.state).toBe('closed')
  })

  it('returns to open if half-open request fails', async () => {
    const target = resource({
      get: async () => ({ headers: { condition: 'error' }, body: null }),
    })

    const breaker = createBreaker(target, { threshold: 1, resetTimeout: 50 })

    // Trigger open
    await breaker.get({ path: '/test' })

    // Wait for reset timeout
    await new Promise(r => setTimeout(r, 60))

    // Half-open request fails
    await breaker.get({ path: '/test' })

    const state = await breaker.get({ path: '/state' })
    expect(state.body.state).toBe('open')
  })

  it('can be reset manually', async () => {
    const target = resource({
      get: async () => ({ headers: { condition: 'error' }, body: null }),
    })

    const breaker = createBreaker(target, { threshold: 1 })

    // Trigger open
    await breaker.get({ path: '/test' })
    let state = await breaker.get({ path: '/state' })
    expect(state.body.state).toBe('open')

    // Reset
    await breaker.put({ path: '/reset' }, {})

    state = await breaker.get({ path: '/state' })
    expect(state.body.state).toBe('closed')
    expect(state.body.failures).toBe(0)
  })

  it('uses custom fallback', async () => {
    const target = resource({
      get: async () => ({ headers: { condition: 'error' }, body: null }),
    })

    const breaker = createBreaker(target, {
      threshold: 1,
      fallback: () => ({ headers: {}, body: { cached: true } }),
    })

    // Trigger open
    await breaker.get({ path: '/test' })

    // Fallback should return cached data
    const result = await breaker.get({ path: '/test' })
    expect(result.body).toEqual({ cached: true })
  })
})

describe('createRetry', () => {
  it('succeeds on first attempt', async () => {
    let attempts = 0
    const target = resource({
      get: async () => {
        attempts++
        return { headers: {}, body: { ok: true } }
      },
    })

    const retry = createRetry(target)

    const result = await retry.get({ path: '/test' })
    expect(result.body).toEqual({ ok: true })
    expect(attempts).toBe(1)
  })

  it('retries on failure', async () => {
    let attempts = 0
    const target = resource({
      get: async () => {
        attempts++
        if (attempts < 3) {
          return { headers: { condition: 'error' }, body: null }
        }
        return { headers: {}, body: { ok: true } }
      },
    })

    const retry = createRetry(target, { maxAttempts: 3, baseDelay: 10 })

    const result = await retry.get({ path: '/test' })
    expect(result.body).toEqual({ ok: true })
    expect(attempts).toBe(3)

    const stats = await retry.get({ path: '/stats' })
    expect(stats.body.retries).toBe(2)
    expect(stats.body.successes).toBe(1)
  })

  it('gives up after max attempts', async () => {
    const target = resource({
      get: async () => ({ headers: { condition: 'error' }, body: { fail: true } }),
    })

    const retry = createRetry(target, { maxAttempts: 3, baseDelay: 10 })

    const result = await retry.get({ path: '/test' })
    expect(result.headers.condition).toBe('error')

    const stats = await retry.get({ path: '/stats' })
    expect(stats.body.attempts).toBe(3)
    expect(stats.body.failures).toBe(1)
  })

  it('uses exponential backoff', async () => {
    const times = []
    const target = resource({
      get: async () => {
        times.push(Date.now())
        if (times.length < 3) {
          return { headers: { condition: 'error' }, body: null }
        }
        return { headers: {}, body: { ok: true } }
      },
    })

    const retry = createRetry(target, { maxAttempts: 3, baseDelay: 50, factor: 2 })

    await retry.get({ path: '/test' })

    // Check delays increase (accounting for jitter)
    const delay1 = times[1] - times[0]
    const delay2 = times[2] - times[1]
    expect(delay1).toBeGreaterThan(30) // ~50ms with jitter
    expect(delay2).toBeGreaterThan(60) // ~100ms with jitter
  })

  it('uses custom shouldRetry predicate', async () => {
    let attempts = 0
    const target = resource({
      get: async () => {
        attempts++
        return { headers: {}, body: { status: attempts < 2 ? 'pending' : 'done' } }
      },
    })

    const retry = createRetry(target, {
      maxAttempts: 5,
      baseDelay: 10,
      shouldRetry: result => result.body?.status === 'pending',
    })

    const result = await retry.get({ path: '/test' })
    expect(result.body.status).toBe('done')
    expect(attempts).toBe(2)
  })
})

describe('createLimiter', () => {
  it('allows requests within limit', async () => {
    const target = resource({
      get: async () => ({ headers: {}, body: { ok: true } }),
    })

    const limiter = createLimiter(target, { capacity: 5, refillRate: 1 })

    // Should allow 5 requests
    for (let i = 0; i < 5; i++) {
      const result = await limiter.get({ path: '/test' })
      expect(result.body).toEqual({ ok: true })
    }

    const quota = await limiter.get({ path: '/quota' })
    expect(quota.body.stats.allowed).toBe(5)
  })

  it('rejects requests over limit', async () => {
    const target = resource({
      get: async () => ({ headers: {}, body: { ok: true } }),
    })

    const limiter = createLimiter(target, { capacity: 2, refillRate: 0.001 }) // Very slow refill

    // First 2 should succeed
    await limiter.get({ path: '/test' })
    await limiter.get({ path: '/test' })

    // Third should be rate limited
    const result = await limiter.get({ path: '/test' })
    expect(result.headers.condition).toBe('rate-limited')
    expect(result.body.error).toBe('rate limit exceeded')

    const quota = await limiter.get({ path: '/quota' })
    expect(quota.body.stats.rejected).toBe(1)
  })

  it('refills tokens over time', async () => {
    const target = resource({
      get: async () => ({ headers: {}, body: { ok: true } }),
    })

    const limiter = createLimiter(target, { capacity: 1, refillRate: 100 }) // 100 tokens/sec

    // Use the token
    await limiter.get({ path: '/test' })

    // Should be rate limited
    let result = await limiter.get({ path: '/test' })
    expect(result.headers.condition).toBe('rate-limited')

    // Wait for refill (10ms = 1 token at 100/sec)
    await new Promise(r => setTimeout(r, 15))

    // Should work now
    result = await limiter.get({ path: '/test' })
    expect(result.body).toEqual({ ok: true })
  })

  it('tracks quota correctly', async () => {
    const target = resource({
      get: async () => ({ headers: {}, body: { ok: true } }),
    })

    const limiter = createLimiter(target, { capacity: 10, refillRate: 1 })

    const quota = await limiter.get({ path: '/quota' })
    expect(quota.body.capacity).toBe(10)
    expect(quota.body.refillRate).toBe(1)
    expect(quota.body.tokens).toBeLessThanOrEqual(10)
  })
})

describe('createTracer', () => {
  it('records traces for requests', async () => {
    const target = resource({
      get: async () => ({ headers: {}, body: { ok: true } }),
    })

    const tracer = createTracer(target)

    await tracer.get({ path: '/users/123' })
    await tracer.get({ path: '/posts' })

    const traces = await tracer.get({ path: '/traces' })
    expect(traces.body.traces).toHaveLength(2)
    expect(traces.body.traces[0].path).toBe('/users/123')
    expect(traces.body.traces[0].op).toBe('get')
    expect(traces.body.traces[0].elapsed).toBeGreaterThanOrEqual(0)
    expect(traces.body.traces[1].path).toBe('/posts')
  })

  it('records put operations with body size', async () => {
    const target = resource({
      put: async (h, b) => ({ headers: {}, body: { received: b } }),
    })

    const tracer = createTracer(target)

    await tracer.put({ path: '/data' }, { foo: 'bar', baz: 123 })

    const traces = await tracer.get({ path: '/traces' })
    expect(traces.body.traces[0].op).toBe('put')
    expect(traces.body.traces[0].bodySize).toBeGreaterThan(0)
  })

  it('records errors', async () => {
    const target = resource({
      get: async () => ({ headers: { condition: 'error' }, body: { error: 'Something broke' } }),
    })

    const tracer = createTracer(target)

    const result = await tracer.get({ path: '/fail' })
    expect(result.headers.condition).toBe('error')

    const traces = await tracer.get({ path: '/traces' })
    expect(traces.body.traces[0].condition).toBe('error')
  })

  it('records thrown exceptions as error conditions', async () => {
    // Note: resource() wraps handlers with safe() which catches exceptions
    // and converts them to error conditions. This is by design.
    const target = resource({
      get: async () => {
        throw new Error('Something broke')
      },
    })

    const tracer = createTracer(target)

    // Exception is converted to error condition by resource()
    const result = await tracer.get({ path: '/fail' })
    expect(result.headers.condition).toBe('error')
    expect(result.body.error).toBe('Something broke')

    const traces = await tracer.get({ path: '/traces' })
    expect(traces.body.traces[0].condition).toBe('error')
  })

  it('limits trace history', async () => {
    const target = resource({
      get: async () => ({ headers: {}, body: { ok: true } }),
    })

    const tracer = createTracer(target, { maxTraces: 5 })

    for (let i = 0; i < 10; i++) {
      await tracer.get({ path: `/request/${i}` })
    }

    const traces = await tracer.get({ path: '/traces' })
    expect(traces.body.traces).toHaveLength(5)
    expect(traces.body.traces[0].path).toBe('/request/5') // Oldest kept
  })

  it('can clear traces', async () => {
    const target = resource({
      get: async () => ({ headers: {}, body: { ok: true } }),
    })

    const tracer = createTracer(target)

    await tracer.get({ path: '/test1' })
    await tracer.get({ path: '/test2' })

    const result = await tracer.put({ path: '/clear' }, {})
    expect(result.body.cleared).toBe(2)

    const traces = await tracer.get({ path: '/traces' })
    expect(traces.body.traces).toHaveLength(0)
  })

  it('calls onTrace callback', async () => {
    const recorded = []
    const target = resource({
      get: async () => ({ headers: {}, body: { ok: true } }),
    })

    const tracer = createTracer(target, {
      onTrace: trace => recorded.push(trace),
    })

    await tracer.get({ path: '/test' })

    expect(recorded).toHaveLength(1)
    expect(recorded[0].path).toBe('/test')
  })

  it('filters traces by condition', async () => {
    const target = resource({
      get: async h => {
        if (h.path.includes('error')) {
          return { headers: { condition: 'error' }, body: null }
        }
        return { headers: {}, body: { ok: true } }
      },
    })

    const tracer = createTracer(target)

    await tracer.get({ path: '/ok1' })
    await tracer.get({ path: '/error1' })
    await tracer.get({ path: '/ok2' })
    await tracer.get({ path: '/error2' })

    const allTraces = await tracer.get({ path: '/traces' })
    expect(allTraces.body.traces).toHaveLength(4)

    const errorTraces = await tracer.get({ path: '/traces', filter: 'error' })
    expect(errorTraces.body.traces).toHaveLength(2)
  })
})

describe('pattern composition', () => {
  it('composes breaker with retry', async () => {
    let attempts = 0
    const target = resource({
      get: async () => {
        attempts++
        if (attempts <= 2) {
          return { headers: { condition: 'error' }, body: null }
        }
        return { headers: {}, body: { ok: true } }
      },
    })

    // Retry wraps target, breaker wraps retry
    const retry = createRetry(target, { maxAttempts: 3, baseDelay: 10 })
    const breaker = createBreaker(retry, { threshold: 5 })

    const result = await breaker.get({ path: '/test' })
    expect(result.body).toEqual({ ok: true })
    expect(attempts).toBe(3)

    // Breaker should still be closed (retry handled the failures)
    const state = await breaker.get({ path: '/state' })
    expect(state.body.state).toBe('closed')
  })

  it('composes limiter with tracer', async () => {
    const target = resource({
      get: async () => ({ headers: {}, body: { ok: true } }),
    })

    // Tracer wraps target, limiter wraps tracer
    const traced = createTracer(target)
    const limited = createLimiter(traced, { capacity: 2, refillRate: 0.001 })

    // Two requests succeed
    await limited.get({ path: '/a' })
    await limited.get({ path: '/b' })

    // Third is rate limited (doesn't reach tracer)
    const result = await limited.get({ path: '/c' })
    expect(result.headers.condition).toBe('rate-limited')

    // Tracer only saw 2 requests
    const traces = await traced.get({ path: '/traces' })
    expect(traces.body.traces).toHaveLength(2)
  })

  it('full observability stack', async () => {
    const target = resource({
      get: async h => {
        if (h.path.includes('fail')) {
          return { headers: { condition: 'error' }, body: null }
        }
        return { headers: {}, body: { data: 'test' } }
      },
    })

    // Build stack: limiter → breaker → retry → tracer → target
    const traced = createTracer(target)
    const retried = createRetry(traced, { maxAttempts: 2, baseDelay: 10 })
    const protected_ = createBreaker(retried, { threshold: 3 })
    const limited = createLimiter(protected_, { capacity: 100, refillRate: 10 })

    // Successful request
    const result = await limited.get({ path: '/ok' })
    expect(result.body).toEqual({ data: 'test' })

    // Check all layers recorded correctly
    const quota = await limited.get({ path: '/quota' })
    expect(quota.body.stats.allowed).toBe(1)

    const breakerState = await protected_.get({ path: '/state' })
    expect(breakerState.body.successes).toBe(1)

    const retryStats = await retried.get({ path: '/stats' })
    expect(retryStats.body.successes).toBe(1)

    const traces = await traced.get({ path: '/traces' })
    expect(traces.body.traces.length).toBeGreaterThanOrEqual(1)
  })
})
