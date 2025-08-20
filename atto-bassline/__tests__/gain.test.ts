/**
 * Tests for gain allocation and amplification system
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { 
  createTransistor,
  createGainMinter,
  createSignal,
  propagate,
  createGadget
} from '../src'
import { clearReceipts, getAllReceipts } from '../src/receipts'

describe('Gain System', () => {
  beforeEach(() => {
    clearReceipts()
  })
  
  describe('Transistor Amplification', () => {
    it('should pass through signals when control <= 1.0', () => {
      const transistor = createTransistor('test-trans')
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      const output = transistor.contacts.get('output')!
      
      propagate(input, createSignal(42, 0.8))
      propagate(control, createSignal(0.5, 1.0))  // Attenuate to 50%
      
      expect(output.signal.value).toBe(42)
      expect(output.signal.strength).toBeCloseTo(0.4)
    })
    
    it('should not amplify without gain', () => {
      const transistor = createTransistor('test-trans')
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      const output = transistor.contacts.get('output')!
      
      expect(transistor.gainPool).toBe(0)
      
      propagate(input, createSignal(42, 0.5))
      propagate(control, createSignal(2.0, 1.0))  // Try 2x amplification
      
      // Should not amplify without gain
      expect(output.signal.value).toBe(42)
      expect(output.signal.strength).toBeCloseTo(0.5)  // No amplification
    })
    
    it('should amplify when gain is available', () => {
      const transistor = createTransistor('test-trans')
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      const output = transistor.contacts.get('output')!
      
      // Add gain to the transistor
      transistor.gainPool = 1.5
      
      propagate(input, createSignal(42, 0.5))
      propagate(control, createSignal(2.0, 1.0))  // 2x amplification
      
      expect(output.signal.value).toBe(42)
      expect(output.signal.strength).toBeCloseTo(1.0)  // 0.5 * 2.0
      expect(transistor.gainPool).toBeCloseTo(0.5)  // 1.5 - 1.0 used
    })
    
    it('should consume gain when amplifying', () => {
      const transistor = createTransistor('test-trans')
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      const output = transistor.contacts.get('output')!
      
      transistor.gainPool = 2.0
      
      // First amplification
      propagate(input, createSignal('A', 0.4))
      propagate(control, createSignal(1.5, 1.0))  // Uses 0.5 gain
      
      expect(output.signal.strength).toBeCloseTo(0.6)
      expect(transistor.gainPool).toBeCloseTo(1.5)
      
      // Second amplification with higher strength to override
      propagate(control, createSignal(2.0, 1.2))  // Uses 1.0 gain
      
      expect(output.signal.strength).toBeCloseTo(0.8)
      expect(transistor.gainPool).toBeCloseTo(0.5)
    })
    
    it('should cap amplification at available gain', () => {
      const transistor = createTransistor('test-trans')
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      const output = transistor.contacts.get('output')!
      
      transistor.gainPool = 0.3  // Only 0.3 gain available
      
      propagate(input, createSignal(100, 0.5))
      propagate(control, createSignal(2.0, 1.0))  // Wants 1.0 gain
      
      // Should only amplify by 1.3x (1.0 + 0.3 available)
      expect(output.signal.strength).toBeCloseTo(0.65)  // 0.5 * 1.3
      expect(transistor.gainPool).toBe(0)  // All consumed
    })
    
    it('should generate receipts for gain consumption', () => {
      const transistor = createTransistor('amp-receipts')
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      
      transistor.gainPool = 1.0
      
      propagate(input, createSignal('test', 0.5))
      propagate(control, createSignal(1.7, 1.0))  // Uses 0.7 gain
      
      const receipts = getAllReceipts()
      expect(receipts).toHaveLength(1)
      expect(receipts[0].gadgetId).toBe('amp-receipts')
      expect(receipts[0].amount).toBeCloseTo(0.7)
      expect(receipts[0].reason).toContain('Amplification')
    })
  })
  
  describe('Gain Minter', () => {
    it('should not mint when validator is false', () => {
      const minter = createGainMinter('test-minter')
      const target = createGadget('target')
      ;(minter as any).registerTarget(target)
      
      const amount = minter.contacts.get('amount')!
      const validator = minter.contacts.get('validator')!
      const targetContact = minter.contacts.get('target')!
      const success = minter.contacts.get('success')!
      
      expect(target.gainPool).toBe(0)
      
      propagate(amount, createSignal(5.0, 1.0))
      propagate(validator, createSignal(false, 1.0))
      propagate(targetContact, createSignal('target', 1.0))
      
      expect(success.signal.value).toBe(false)
      expect(target.gainPool).toBe(0)  // No gain minted
    })
    
    it('should mint when validator is true', () => {
      const minter = createGainMinter('test-minter')
      const target = createGadget('target')
      ;(minter as any).registerTarget(target)
      
      const amount = minter.contacts.get('amount')!
      const validator = minter.contacts.get('validator')!
      const targetContact = minter.contacts.get('target')!
      const success = minter.contacts.get('success')!
      
      expect(target.gainPool).toBe(0)
      
      propagate(amount, createSignal(3.5, 1.0))
      propagate(validator, createSignal(true, 1.0))
      propagate(targetContact, createSignal('target', 1.0))
      
      expect(success.signal.value).toBe(true)
      expect(target.gainPool).toBe(3.5)  // Gain minted
    })
    
    it('should reject invalid amounts', () => {
      const minter = createGainMinter('test-minter')
      const target = createGadget('target')
      ;(minter as any).registerTarget(target)
      
      const amount = minter.contacts.get('amount')!
      const validator = minter.contacts.get('validator')!
      const targetContact = minter.contacts.get('target')!
      const success = minter.contacts.get('success')!
      
      // Try negative amount
      propagate(amount, createSignal(-1.0, 1.0))
      propagate(validator, createSignal(true, 1.0))
      propagate(targetContact, createSignal('target', 1.0))
      
      expect(success.signal.value).toBe(false)
      expect(target.gainPool).toBe(0)
      
      // Try non-number
      propagate(amount, createSignal('five', 1.2))
      
      expect(success.signal.value).toBe(false)
      expect(target.gainPool).toBe(0)
    })
    
    it('should generate receipts for minted gain', () => {
      const minter = createGainMinter('mint-receipts')
      const target = createGadget('target')
      ;(minter as any).registerTarget(target)
      
      const amount = minter.contacts.get('amount')!
      const validator = minter.contacts.get('validator')!
      const targetContact = minter.contacts.get('target')!
      
      propagate(amount, createSignal(2.5, 1.0))
      propagate(validator, createSignal(true, 1.0))
      propagate(targetContact, createSignal('target', 1.0))
      
      const receipts = getAllReceipts()
      expect(receipts).toHaveLength(1)
      expect(receipts[0].gadgetId).toBe('target')
      expect(receipts[0].amount).toBe(2.5)
      expect(receipts[0].reason).toContain('mint-receipts')
    })
    
    it('should use minimum strength of inputs', () => {
      const minter = createGainMinter('test-minter')
      const target = createGadget('target')
      ;(minter as any).registerTarget(target)
      
      const amount = minter.contacts.get('amount')!
      const validator = minter.contacts.get('validator')!
      const targetContact = minter.contacts.get('target')!
      const success = minter.contacts.get('success')!
      
      propagate(amount, createSignal(1.0, 0.3))
      propagate(validator, createSignal(true, 0.8))
      propagate(targetContact, createSignal('target', 0.5))
      
      // Output strength should be MIN(0.3, 0.8, 0.5) = 0.3
      expect(success.signal.strength).toBeCloseTo(0.3)
    })
  })
  
  describe('Path Competition', () => {
    it('should allow gradual drowning via amplification', () => {
      const pathA = createTransistor('path-a')
      const pathB = createTransistor('path-b')
      const merger = createGadget('merger')
      const mergeContact = merger.contacts.get('merge') || 
                         (() => { 
                           const c = createSignal(null, 0)
                           merger.contacts.set('merge', {
                             id: 'merge',
                             direction: 'input',
                             boundary: false,
                             signal: c,
                             gadget: new WeakRef(merger),
                             sources: new Set(),
                             targets: new Set()
                           })
                           return merger.contacts.get('merge')!
                         })()
      
      // Wire outputs to merger
      const outA = pathA.contacts.get('output')!
      const outB = pathB.contacts.get('output')!
      outA.targets.add(new WeakRef(mergeContact))
      outB.targets.add(new WeakRef(mergeContact))
      
      // Give path B gain to amplify
      pathB.gainPool = 1.0
      
      const inA = pathA.contacts.get('input')!
      const inB = pathB.contacts.get('input')!
      const ctrlA = pathA.contacts.get('control')!
      const ctrlB = pathB.contacts.get('control')!
      
      // Both start equal
      propagate(inA, createSignal('A', 0.5))
      propagate(inB, createSignal('B', 0.5))
      propagate(ctrlA, createSignal(1.0, 1.0))
      propagate(ctrlB, createSignal(1.0, 1.0))
      
      // A wins initially (or tie)
      expect(outA.signal.strength).toBeCloseTo(0.5)
      expect(outB.signal.strength).toBeCloseTo(0.5)
      
      // Boost B to win
      propagate(ctrlB, createSignal(1.6, 1.1))  // 1.6x amplification
      
      expect(outB.signal.strength).toBeCloseTo(0.8)  // 0.5 * 1.6
      expect(outA.signal.strength).toBeCloseTo(0.5)  // Unchanged
      
      // B should have consumed gain
      expect(pathB.gainPool).toBeCloseTo(0.4)  // 1.0 - 0.6 used
    })
  })
})