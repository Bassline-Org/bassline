import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Platform } from '../src/platform.js'
import { reducers, scope } from '../src/modules/index.js'
import tracing from '../src/modules/tracing.js'

describe('Tracing module', () => {
  let writeSpy
  let original

  beforeEach(() => {
    original = process.stdout.write
    writeSpy = vi.fn()
    process.stdout.write = writeSpy
  })

  afterEach(() => {
    process.stdout.write = original
  })

  function setup() {
    const p = new Platform()
    p.use(reducers, scope, tracing)
    return p
  }

  function lines() {
    return writeSpy.mock.calls
      .map(([str]) => str)
      .filter(s => s.endsWith('\n'))
      .map(s => JSON.parse(s))
  }

  it('logs resource.mounted events', () => {
    const p = setup()
    p.root({ put: p.create.Slot({ value: 0 }), at: 'counter' })

    const mounted = lines().filter(l => l.event === 'mounted')
    expect(mounted.length).toBeGreaterThan(0)
    expect(mounted.some(l => l.name === 'counter')).toBe(true)
  })

  it('logs resource.unmounted events', () => {
    const p = setup()
    p.root({ put: p.create.Slot({ value: 0 }), at: 'x' })
    p.root({ put: null, at: 'x' })

    const unmounted = lines().filter(l => l.event === 'unmounted')
    expect(unmounted.some(l => l.name === 'x')).toBe(true)
  })

  it('does not log resource.fired events', () => {
    const p = setup()
    const slot = p.create.Slot({ value: 0 })
    p.root({ put: slot, at: 'counter' })

    writeSpy.mockClear()
    slot({})

    const fired = lines().filter(l => l.event === 'fired')
    expect(fired.length).toBe(0)
  })

  it('logs server events when http is used', () => {
    const p = setup()

    // Manually announce server events (no need for real HTTP server)
    p.announce('server.started', { port: 3000 })
    p.announce('server.stopping', { port: 3000 })

    const started = lines().filter(l => l.event === 'server.started')
    expect(started.length).toBe(1)
    expect(started[0].port).toBe(3000)

    const stopping = lines().filter(l => l.event === 'server.stopping')
    expect(stopping.length).toBe(1)
  })

  it('each line has a timestamp', () => {
    const p = setup()
    p.root({ put: p.create.Slot({ value: 0 }), at: 'x' })

    const all = lines()
    expect(all.length).toBeGreaterThan(0)
    for (const line of all) {
      expect(typeof line.ts).toBe('number')
    }
  })
})
