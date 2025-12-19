import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTimers } from '../src/timers.js'
import { createMockKit } from './helpers.js'

describe('createTimers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists timers at root', async () => {
    const timers = createTimers()
    const result = await timers.get({ path: '/' })

    expect(result.headers.type).toBe('/types/bassline')
    expect(result.body.name).toBe('timers')
  })

  it('creates timer', async () => {
    const timers = createTimers()
    const result = await timers.put({ path: '/heartbeat' }, { interval: 1000 })

    expect(result.body.interval).toBe(1000)
    expect(result.body.enabled).toBe(false)
    expect(result.body.running).toBe(false)
    expect(result.body.tickCount).toBe(0)
  })

  it('gets timer by name', async () => {
    const timers = createTimers()

    await timers.put({ path: '/heartbeat' }, { interval: 1000 })

    const result = await timers.get({ path: '/heartbeat' })
    expect(result.headers.type).toBe('/types/timer')
    expect(result.body.interval).toBe(1000)
  })

  it('returns not-found for missing timer', async () => {
    const timers = createTimers()
    const result = await timers.get({ path: '/missing' })

    expect(result.headers.condition).toBe('not-found')
  })

  it('auto-starts when enabled is true and kit provided', async () => {
    const kit = createMockKit()
    const timers = createTimers()

    await timers.put({ path: '/ticker', kit }, { interval: 100, enabled: true })

    // Timer should be running
    const result = await timers.get({ path: '/ticker' })
    expect(result.body.running).toBe(true)

    // Advance time and check ticks
    await vi.advanceTimersByTimeAsync(250)

    const calls = kit.calls()
    const ticks = calls.filter(c => c.headers.path === '/tick')
    expect(ticks.length).toBe(2)
    expect(ticks[0].body.timer).toBe('ticker')
    expect(ticks[0].body.tick).toBe(1)
    expect(ticks[1].body.tick).toBe(2)
  })

  describe('start', () => {
    it('starts a stopped timer', async () => {
      const kit = createMockKit()
      const timers = createTimers()

      await timers.put({ path: '/test', kit }, { interval: 100 })

      // Start the timer
      await timers.put({ path: '/test/start', kit }, null)

      const result = await timers.get({ path: '/test' })
      expect(result.body.running).toBe(true)

      // Verify ticks happen
      await vi.advanceTimersByTimeAsync(150)

      const ticks = kit.calls().filter(c => c.headers.path === '/tick')
      expect(ticks.length).toBe(1)
    })

    it('returns not-found for missing timer', async () => {
      const kit = createMockKit()
      const timers = createTimers()

      const result = await timers.put({ path: '/missing/start', kit }, null)
      expect(result.headers.condition).toBe('not-found')
    })
  })

  describe('stop', () => {
    it('stops a running timer', async () => {
      const kit = createMockKit()
      const timers = createTimers()

      await timers.put({ path: '/test', kit }, { interval: 100, enabled: true })

      // Let it tick once
      await vi.advanceTimersByTimeAsync(150)

      // Stop it
      await timers.put({ path: '/test/stop' }, null)

      const result = await timers.get({ path: '/test' })
      expect(result.body.running).toBe(false)

      // Reset kit and advance time - no more ticks
      kit.reset()
      await vi.advanceTimersByTimeAsync(200)

      const ticks = kit.calls().filter(c => c.headers.path === '/tick')
      expect(ticks.length).toBe(0)
    })

    it('returns not-found for missing timer', async () => {
      const timers = createTimers()
      const result = await timers.put({ path: '/missing/stop' }, null)

      expect(result.headers.condition).toBe('not-found')
    })
  })

  it('updates timer config and restarts', async () => {
    const kit = createMockKit()
    const timers = createTimers()

    // Create and start timer
    await timers.put({ path: '/test', kit }, { interval: 100, enabled: true })

    await vi.advanceTimersByTimeAsync(150)

    // Update with different interval
    await timers.put({ path: '/test', kit }, { interval: 200, enabled: true })

    kit.reset()

    // With new interval, should take 200ms for next tick
    await vi.advanceTimersByTimeAsync(150)
    expect(kit.calls().filter(c => c.headers.path === '/tick').length).toBe(0)

    await vi.advanceTimersByTimeAsync(100)
    expect(kit.calls().filter(c => c.headers.path === '/tick').length).toBe(1)
  })
})
