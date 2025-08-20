/**
 * Tests for linear gain allocation and amplification system
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { 
  createTransistor,
  createGainMinter,
  signal,
  propagate,
  createGadget,
  createContact,
  KILL_SIGNAL,
  toUnits
} from '../src'
import { clearReceipts, getAllReceipts } from '../src/receipts'

describe('Linear Gain System', () => {
  beforeEach(() => {
    clearReceipts()
  })
  
  describe('Linear Transistor Adjustment', () => {
    it('should attenuate with negative control (free)', () => {
      const transistor = createTransistor('test-trans')
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      const output = transistor.contacts.get('output')!
      
      propagate(input, signal(42, 0.8))  // 8000 units
      propagate(control, signal(-5000, 1.0))  // Reduce by 5000
      
      expect(output.signal.value).toBe(42)
      expect(output.signal.strength).toBe(3000)  // 8000 - 5000
    })
    
    it('should not amplify without gain', () => {
      const transistor = createTransistor('test-trans')
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      const output = transistor.contacts.get('output')!
      
      expect(transistor.gainPool).toBe(0)
      
      propagate(input, signal(42, 0.5))  // 5000 units
      propagate(control, signal(2000, 1.0))  // Try to boost by 2000
      
      // Should not amplify without gain
      expect(output.signal.value).toBe(42)
      expect(output.signal.strength).toBe(5000)  // No amplification
    })
    
    it('should amplify when gain is available', () => {
      const transistor = createTransistor('test-trans')
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      const output = transistor.contacts.get('output')!
      
      // Add gain to the transistor
      transistor.gainPool = 3000
      
      propagate(input, signal(42, 0.5))  // 5000 units
      propagate(control, signal(2000, 1.0))  // Boost by 2000
      
      expect(output.signal.value).toBe(42)
      expect(output.signal.strength).toBe(7000)  // 5000 + 2000
      expect(transistor.gainPool).toBe(1000)  // 3000 - 2000 used
    })
    
    it('should consume gain linearly', () => {
      const transistor = createTransistor('test-trans')
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      const output = transistor.contacts.get('output')!
      
      transistor.gainPool = 5000
      
      // First amplification
      propagate(input, signal('A', 0.4))  // 4000 units
      propagate(control, signal(1500, 1.0))  // Boost by 1500
      
      expect(output.signal.strength).toBe(5500)  // 4000 + 1500
      expect(transistor.gainPool).toBe(3500)  // 5000 - 1500
      
      // Second amplification with higher strength to override
      propagate(control, signal(3000, 1.2))  // Boost by 3000
      
      expect(output.signal.strength).toBe(7000)  // 4000 + 3000
      expect(transistor.gainPool).toBe(500)  // 3500 - 3000
    })
    
    it('should cap amplification at available gain', () => {
      const transistor = createTransistor('test-trans')
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      const output = transistor.contacts.get('output')!
      
      transistor.gainPool = 1500  // Only 1500 units available
      
      propagate(input, signal(100, 0.5))  // 5000 units
      propagate(control, signal(3000, 1.0))  // Want 3000 boost
      
      // Should only amplify by available gain
      expect(output.signal.strength).toBe(6500)  // 5000 + 1500 (capped)
      expect(transistor.gainPool).toBe(0)  // All consumed
    })
    
    it('should handle KILL_SIGNAL', () => {
      const transistor = createTransistor('test-kill')
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      const output = transistor.contacts.get('output')!
      
      propagate(input, signal('critical', 0.9))  // 9000 units
      expect(output.signal.strength).toBe(9000)
      
      // Send kill signal
      propagate(control, signal(KILL_SIGNAL, 1.0))
      
      expect(output.signal.value).toBe('critical')  // Value preserved
      expect(output.signal.strength).toBe(0)  // Muted
    })
    
    it('should generate receipts for gain consumption', () => {
      const transistor = createTransistor('amp-receipts')
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      
      transistor.gainPool = 4000
      
      propagate(input, signal('test', 0.5))  // 5000 units
      propagate(control, signal(2500, 1.0))  // Use 2500 gain
      
      const receipts = getAllReceipts()
      expect(receipts).toHaveLength(1)
      expect(receipts[0].gadgetId).toBe('amp-receipts')
      expect(receipts[0].amount).toBe(2500)
      expect(receipts[0].reason).toContain('2500 units')
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
      
      propagate(amount, signal(5000, 1.0))  // 5000 units
      propagate(validator, signal(false, 1.0))
      propagate(targetContact, signal('target', 1.0))
      
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
      
      propagate(amount, signal(3500, 1.0))  // 3500 units
      propagate(validator, signal(true, 1.0))
      propagate(targetContact, signal('target', 1.0))
      
      expect(success.signal.value).toBe(true)
      expect(target.gainPool).toBe(3500)  // Gain minted
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
      propagate(amount, signal(-1000, 1.0))
      propagate(validator, signal(true, 1.0))
      propagate(targetContact, signal('target', 1.0))
      
      expect(success.signal.value).toBe(false)
      expect(target.gainPool).toBe(0)
      
      // Try non-number
      propagate(amount, signal('five', 1.2))
      
      expect(success.signal.value).toBe(false)
      expect(target.gainPool).toBe(0)
    })
    
    it('should accumulate minted gain', () => {
      const minter = createGainMinter('test-minter')
      const target = createGadget('target')
      ;(minter as any).registerTarget(target)
      
      const amount = minter.contacts.get('amount')!
      const validator = minter.contacts.get('validator')!
      const targetContact = minter.contacts.get('target')!
      
      // First mint
      propagate(amount, signal(2000, 1.0))
      propagate(validator, signal(true, 1.0))
      propagate(targetContact, signal('target', 1.0))
      
      expect(target.gainPool).toBe(2000)
      
      // Second mint (should accumulate)
      // Need to invalidate first, then re-validate to trigger another mint
      propagate(validator, signal(false, 1.1))  // Turn off
      propagate(amount, signal(1500, 1.2))  // New amount
      propagate(validator, signal(true, 1.3))  // Re-trigger
      
      expect(target.gainPool).toBe(3500)  // 2000 + 1500
    })
    
    it('should generate receipts for minted gain', () => {
      const minter = createGainMinter('mint-receipts')
      const target = createGadget('target')
      ;(minter as any).registerTarget(target)
      
      const amount = minter.contacts.get('amount')!
      const validator = minter.contacts.get('validator')!
      const targetContact = minter.contacts.get('target')!
      
      propagate(amount, signal(2500, 1.0))
      propagate(validator, signal(true, 1.0))
      propagate(targetContact, signal('target', 1.0))
      
      const receipts = getAllReceipts()
      expect(receipts).toHaveLength(1)
      expect(receipts[0].gadgetId).toBe('target')
      expect(receipts[0].amount).toBe(2500)
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
      
      propagate(amount, signal(1000, 0.3))  // 3000 strength
      propagate(validator, signal(true, 0.8))  // 8000 strength
      propagate(targetContact, signal('target', 0.5))  // 5000 strength
      
      // Output strength should be MIN(3000, 8000, 5000) = 3000
      expect(success.signal.strength).toBe(3000)
    })
  })
  
  describe('Path Competition with Linear Adjustment', () => {
    it('should allow gradual drowning via amplification and attenuation', () => {
      const pathA = createTransistor('path-a')
      const pathB = createTransistor('path-b')
      const merger = createGadget('merger')
      const mergeContact = createContact('merge', merger, undefined, 'input')
      merger.contacts.set('merge', mergeContact)
      
      // Wire outputs to merger
      const outA = pathA.contacts.get('output')!
      const outB = pathB.contacts.get('output')!
      outA.targets.add(new WeakRef(mergeContact))
      outB.targets.add(new WeakRef(mergeContact))
      
      // Give path B gain to amplify
      pathB.gainPool = 5000
      
      const inA = pathA.contacts.get('input')!
      const inB = pathB.contacts.get('input')!
      const ctrlA = pathA.contacts.get('control')!
      const ctrlB = pathB.contacts.get('control')!
      
      // Both start equal
      propagate(inA, signal('A', 0.5))  // 5000 units
      propagate(inB, signal('B', 0.5))  // 5000 units
      propagate(ctrlA, signal(0, 1.0))
      propagate(ctrlB, signal(0, 1.0))
      
      expect(outA.signal.strength).toBe(5000)
      expect(outB.signal.strength).toBe(5000)
      
      // Boost B to win
      propagate(ctrlB, signal(3000, 1.1))  // +3000
      
      expect(outB.signal.strength).toBe(8000)  // 5000 + 3000
      expect(outA.signal.strength).toBe(5000)  // Unchanged
      
      // Also attenuate A (free)
      propagate(ctrlA, signal(-2000, 1.2))  // -2000
      
      expect(outA.signal.strength).toBe(3000)  // 5000 - 2000
      
      // B should have consumed gain
      expect(pathB.gainPool).toBe(2000)  // 5000 - 3000 used
    })
    
    it('should handle kill signal in competition', () => {
      const pathA = createTransistor('path-a')
      const pathB = createTransistor('path-b')
      
      const inA = pathA.contacts.get('input')!
      const inB = pathB.contacts.get('input')!
      const ctrlA = pathA.contacts.get('control')!
      const ctrlB = pathB.contacts.get('control')!
      const outA = pathA.contacts.get('output')!
      const outB = pathB.contacts.get('output')!
      
      // Both active
      propagate(inA, signal('A', 0.7))
      propagate(inB, signal('B', 0.7))
      propagate(ctrlA, signal(0, 1.0))
      propagate(ctrlB, signal(0, 1.0))
      
      expect(outA.signal.strength).toBe(7000)
      expect(outB.signal.strength).toBe(7000)
      
      // Kill path A
      propagate(ctrlA, signal(KILL_SIGNAL, 1.1))
      
      expect(outA.signal.strength).toBe(0)  // Killed
      expect(outB.signal.strength).toBe(7000)  // Still active
      
      // B wins by default since A is muted
    })
  })
  
  describe('Entropy Principle', () => {
    it('should allow free signal reduction (entropy increase)', () => {
      const transistor = createTransistor('entropy-test')
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      const output = transistor.contacts.get('output')!
      
      expect(transistor.gainPool).toBe(0)  // No gain
      
      propagate(input, signal('data', 1.0))  // Max strength
      
      // Can always reduce (increase entropy) without gain
      propagate(control, signal(-2000, 1.0))
      expect(output.signal.strength).toBe(8000)
      
      propagate(control, signal(-5000, 1.1))
      expect(output.signal.strength).toBe(5000)
      
      propagate(control, signal(-9999, 1.2))
      expect(output.signal.strength).toBe(1)  // Nearly zero
      
      // All reductions were free, no gain consumed
      expect(transistor.gainPool).toBe(0)
    })
    
    it('should require gain for signal amplification (entropy decrease)', () => {
      const transistor = createTransistor('entropy-test')
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      const output = transistor.contacts.get('output')!
      
      propagate(input, signal('data', 0.1))  // Low strength (1000 units)
      
      // Try to amplify without gain
      propagate(control, signal(5000, 1.0))
      expect(output.signal.strength).toBe(1000)  // No change
      
      // Add gain and try again
      transistor.gainPool = 8000
      propagate(control, signal(5000, 1.1))
      expect(output.signal.strength).toBe(6000)  // 1000 + 5000
      
      // Amplification consumed gain
      expect(transistor.gainPool).toBe(3000)  // 8000 - 5000
    })
  })
})