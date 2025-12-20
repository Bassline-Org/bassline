import { describe, it, expect } from 'vitest'
import { createTrust, trustEstimate } from '../src/index.js'

describe('trustEstimate lattice', () => {
  describe('initial', () => {
    it('starts with neutral trust (0.5)', () => {
      const initial = trustEstimate.initial()
      expect(initial.value).toBe(0.5)
      expect(initial.samples).toBe(0)
      expect(initial.variance).toBe(0.25)
    })
  })

  describe('observe', () => {
    it('increases trust with positive outcome', () => {
      const initial = trustEstimate.initial()
      const updated = trustEstimate.observe(initial, 1)

      expect(updated.value).toBeGreaterThan(0.5)
      expect(updated.samples).toBe(1)
    })

    it('decreases trust with negative outcome', () => {
      const initial = trustEstimate.initial()
      const updated = trustEstimate.observe(initial, 0)

      expect(updated.value).toBeLessThan(0.5)
      expect(updated.samples).toBe(1)
    })

    it('converges with multiple observations', () => {
      let estimate = trustEstimate.initial()

      // 8 positive, 2 negative = 80% trust
      for (let i = 0; i < 8; i++) estimate = trustEstimate.observe(estimate, 1)
      for (let i = 0; i < 2; i++) estimate = trustEstimate.observe(estimate, 0)

      expect(estimate.samples).toBe(10)
      expect(estimate.value).toBeCloseTo(0.8, 1)
    })

    it('handles null estimate', () => {
      const updated = trustEstimate.observe(null, 1)
      expect(updated.samples).toBe(1)
    })

    it('maintains variance floor to prevent zero', () => {
      let estimate = trustEstimate.initial()
      // Many identical observations should still have minimum variance
      for (let i = 0; i < 100; i++) estimate = trustEstimate.observe(estimate, 1)

      expect(estimate.variance).toBeGreaterThanOrEqual(0.001)
    })
  })

  describe('merge', () => {
    it('combines estimates with weighted average', () => {
      // 10 samples at 0.8 trust
      let a = trustEstimate.initial()
      for (let i = 0; i < 8; i++) a = trustEstimate.observe(a, 1)
      for (let i = 0; i < 2; i++) a = trustEstimate.observe(a, 0)

      // 10 samples at 0.2 trust
      let b = trustEstimate.initial()
      for (let i = 0; i < 2; i++) b = trustEstimate.observe(b, 1)
      for (let i = 0; i < 8; i++) b = trustEstimate.observe(b, 0)

      const merged = trustEstimate.merge(a, b)

      expect(merged.samples).toBe(20)
      expect(merged.value).toBeCloseTo(0.5, 1) // Equal weight, so ~0.5
    })

    it('returns other when one is empty', () => {
      const empty = trustEstimate.initial()
      const full = trustEstimate.observe(trustEstimate.initial(), 1)

      expect(trustEstimate.merge(empty, full)).toEqual(full)
      expect(trustEstimate.merge(full, empty)).toEqual(full)
    })

    it('handles null inputs', () => {
      const estimate = trustEstimate.observe(trustEstimate.initial(), 1)

      expect(trustEstimate.merge(null, estimate)).toEqual(estimate)
      expect(trustEstimate.merge(estimate, null)).toEqual(estimate)
      expect(trustEstimate.merge(null, null).samples).toBe(0)
    })
  })

  describe('decay', () => {
    it('reduces samples', () => {
      let estimate = trustEstimate.initial()
      for (let i = 0; i < 10; i++) estimate = trustEstimate.observe(estimate, 1)

      const decayed = trustEstimate.decay(estimate, 0.5)

      expect(decayed.samples).toBe(5)
      expect(decayed.value).toBe(estimate.value) // Value unchanged
    })

    it('increases variance as confidence drops', () => {
      let estimate = trustEstimate.initial()
      for (let i = 0; i < 10; i++) estimate = trustEstimate.observe(estimate, 1)

      const decayed = trustEstimate.decay(estimate, 0.5)

      expect(decayed.variance).toBeGreaterThan(estimate.variance)
    })

    it('caps variance at 0.25', () => {
      let estimate = trustEstimate.initial()
      estimate = trustEstimate.observe(estimate, 1)

      const decayed = trustEstimate.decay(estimate, 0.1)

      expect(decayed.variance).toBeLessThanOrEqual(0.25)
    })

    it('handles null input', () => {
      const result = trustEstimate.decay(null)
      expect(result).toEqual(trustEstimate.initial())
    })
  })

  describe('meetsThreshold', () => {
    it('requires minimum samples', () => {
      let estimate = trustEstimate.initial()
      estimate = trustEstimate.observe(estimate, 1) // 1 sample, high trust

      expect(trustEstimate.meetsThreshold(estimate, 0.5, 3)).toBe(false)
    })

    it('passes when above threshold with enough samples', () => {
      let estimate = trustEstimate.initial()
      for (let i = 0; i < 5; i++) estimate = trustEstimate.observe(estimate, 1)

      expect(trustEstimate.meetsThreshold(estimate, 0.5, 3)).toBe(true)
    })

    it('fails when below threshold', () => {
      let estimate = trustEstimate.initial()
      for (let i = 0; i < 5; i++) estimate = trustEstimate.observe(estimate, 0)

      expect(trustEstimate.meetsThreshold(estimate, 0.5, 3)).toBe(false)
    })

    it('handles null estimate', () => {
      expect(trustEstimate.meetsThreshold(null, 0.5)).toBe(false)
    })
  })

  describe('confidenceInterval', () => {
    it('returns full range for zero samples', () => {
      const initial = trustEstimate.initial()
      const ci = trustEstimate.confidenceInterval(initial)

      expect(ci.low).toBe(0)
      expect(ci.high).toBe(1)
    })

    it('narrows with more samples', () => {
      let estimate = trustEstimate.initial()
      for (let i = 0; i < 100; i++) {
        estimate = trustEstimate.observe(estimate, Math.random() > 0.3 ? 1 : 0)
      }

      const ci = trustEstimate.confidenceInterval(estimate)

      expect(ci.high - ci.low).toBeLessThan(0.5) // Tighter interval
    })

    it('bounds to valid range [0, 1]', () => {
      let estimate = trustEstimate.initial()
      for (let i = 0; i < 10; i++) estimate = trustEstimate.observe(estimate, 1)

      const ci = trustEstimate.confidenceInterval(estimate)

      expect(ci.low).toBeGreaterThanOrEqual(0)
      expect(ci.high).toBeLessThanOrEqual(1)
    })

    it('handles null estimate', () => {
      const ci = trustEstimate.confidenceInterval(null)
      expect(ci).toEqual({ low: 0, high: 1 })
    })
  })
})

describe('createTrust', () => {
  describe('peer management', () => {
    it('lists peers at root', async () => {
      const trust = createTrust()
      const result = await trust.get({ path: '/' })

      expect(result.headers.type).toBe('/types/trust-service')
      expect(result.body.name).toBe('trust')
    })

    it('lists known peers', async () => {
      const trust = createTrust()

      // Observe some peers
      await trust.put({ path: '/observe' }, { peer: 'alice', outcome: 1 })
      await trust.put({ path: '/observe' }, { peer: 'bob', outcome: 0 })

      const result = await trust.get({ path: '/peers' })

      expect(result.body.resources).toHaveProperty('/alice')
      expect(result.body.resources).toHaveProperty('/bob')
    })

    it('gets trust info for peer', async () => {
      const trust = createTrust()

      await trust.put({ path: '/observe' }, { peer: 'alice', outcome: 1 })
      await trust.put({ path: '/observe' }, { peer: 'alice', outcome: 1 })
      await trust.put({ path: '/observe' }, { peer: 'alice', outcome: 1 })

      const result = await trust.get({ path: '/peers/alice' })

      expect(result.headers.type).toBe('/types/trust')
      expect(result.body.id).toBe('alice')
      expect(result.body.samples).toBe(3)
      expect(result.body.value).toBeGreaterThan(0.5)
      expect(result.body.confidence).toBeDefined()
      expect(result.body.capabilities).toBeDefined()
    })

    it('initializes unknown peer with neutral trust', async () => {
      const trust = createTrust()
      const result = await trust.get({ path: '/peers/unknown' })

      expect(result.body.value).toBe(0.5)
      expect(result.body.samples).toBe(0)
    })
  })

  describe('observations', () => {
    it('records positive observation', async () => {
      const trust = createTrust()
      const result = await trust.put({ path: '/observe' }, { peer: 'alice', outcome: 1 })

      expect(result.headers.type).toBe('/types/trust')
      expect(result.body.peer).toBe('alice')
      expect(result.body.value).toBeGreaterThan(0.5)
    })

    it('records negative observation', async () => {
      const trust = createTrust()
      const result = await trust.put({ path: '/observe' }, { peer: 'bob', outcome: 0 })

      expect(result.body.value).toBeLessThan(0.5)
    })

    it('rejects missing peer', async () => {
      const trust = createTrust()
      const result = await trust.put({ path: '/observe' }, { outcome: 1 })

      expect(result.headers.condition).toBe('invalid')
      expect(result.headers.message).toContain('peer')
    })

    it('rejects missing outcome', async () => {
      const trust = createTrust()
      const result = await trust.put({ path: '/observe' }, { peer: 'alice' })

      expect(result.headers.condition).toBe('invalid')
      expect(result.headers.message).toContain('outcome')
    })
  })

  describe('thresholds', () => {
    it('gets default thresholds', async () => {
      const trust = createTrust()
      const result = await trust.get({ path: '/thresholds' })

      expect(result.body.read).toBe(0.2)
      expect(result.body.write).toBe(0.5)
      expect(result.body.install).toBe(0.8)
    })

    it('uses custom initial thresholds', async () => {
      const trust = createTrust({ thresholds: { read: 0.1, write: 0.3 } })
      const result = await trust.get({ path: '/thresholds' })

      expect(result.body.read).toBe(0.1)
      expect(result.body.write).toBe(0.3)
      expect(result.body.install).toBe(0.8) // Default
    })

    it('updates thresholds', async () => {
      const trust = createTrust()
      await trust.put({ path: '/thresholds' }, { write: 0.9 })

      const result = await trust.get({ path: '/thresholds' })
      expect(result.body.write).toBe(0.9)
      expect(result.body.read).toBe(0.2) // Unchanged
    })
  })

  describe('capability checking', () => {
    it('allows access without peer ID', () => {
      const trust = createTrust()
      expect(trust.checkCapability(null, 'write')).toBe(true)
      expect(trust.checkCapability(undefined, 'install')).toBe(true)
    })

    it('allows unknown capability', () => {
      const trust = createTrust()
      expect(trust.checkCapability('alice', 'unknownCapability')).toBe(true)
    })

    it('rejects peer below threshold', async () => {
      const trust = createTrust()

      // Build low trust
      for (let i = 0; i < 5; i++) {
        await trust.put({ path: '/observe' }, { peer: 'badactor', outcome: 0 })
      }

      expect(trust.checkCapability('badactor', 'read')).toBe(false)
    })

    it('allows peer above threshold', async () => {
      const trust = createTrust()

      // Build high trust
      for (let i = 0; i < 5; i++) {
        await trust.put({ path: '/observe' }, { peer: 'goodactor', outcome: 1 })
      }

      expect(trust.checkCapability('goodactor', 'read')).toBe(true)
      expect(trust.checkCapability('goodactor', 'write')).toBe(true)
    })

    it('respects minimum samples requirement', async () => {
      const trust = createTrust()

      // Only 2 positive observations (below default minSamples=3)
      await trust.put({ path: '/observe' }, { peer: 'newpeer', outcome: 1 })
      await trust.put({ path: '/observe' }, { peer: 'newpeer', outcome: 1 })

      expect(trust.checkCapability('newpeer', 'write')).toBe(false)
    })

    it('shows capabilities in peer info', async () => {
      const trust = createTrust()

      // Build trust - 5 positive observations gives high trust (approaches 1.0)
      for (let i = 0; i < 5; i++) {
        await trust.put({ path: '/observe' }, { peer: 'alice', outcome: 1 })
      }

      const result = await trust.get({ path: '/peers/alice' })

      expect(result.body.capabilities.read).toBe(true)
      expect(result.body.capabilities.write).toBe(true)
      // With all positive observations, trust is very high (1.0), meeting install threshold
      expect(result.body.capabilities.install).toBe(true)
    })

    it('denies install for mixed trust history', async () => {
      const trust = createTrust()

      // Mix of positive and negative - should land around 0.6 (not high enough for install at 0.8)
      await trust.put({ path: '/observe' }, { peer: 'bob', outcome: 1 })
      await trust.put({ path: '/observe' }, { peer: 'bob', outcome: 1 })
      await trust.put({ path: '/observe' }, { peer: 'bob', outcome: 0 })
      await trust.put({ path: '/observe' }, { peer: 'bob', outcome: 1 })
      await trust.put({ path: '/observe' }, { peer: 'bob', outcome: 0 })

      const result = await trust.get({ path: '/peers/bob' })

      expect(result.body.capabilities.read).toBe(true)
      expect(result.body.capabilities.write).toBe(true)
      expect(result.body.capabilities.install).toBe(false) // Mixed history, below 0.8
    })
  })

  describe('exposed helpers', () => {
    it('exposes getTrust method', async () => {
      const trust = createTrust()
      await trust.put({ path: '/observe' }, { peer: 'alice', outcome: 1 })

      const peerTrust = trust.getTrust('alice')
      expect(peerTrust.samples).toBe(1)
    })

    it('exposes observe method', () => {
      const trust = createTrust()
      const updated = trust.observe('bob', 1)

      expect(updated.samples).toBe(1)
    })
  })
})
