/**
 * Core tests for strength-based propagation system
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createGadget,
  createContact,
  signal,
  wire,
  propagate,
  createTransistor,
  createAdder,
  formatStrength,
  KILL_SIGNAL,
  toUnits,
  clearReceipts,
  getAllReceipts
} from '../src'

describe('Core Propagation', () => {
  describe('Argmax with Hysteresis', () => {
    it('should accept stronger signals', () => {
      const gadget = createGadget('test')
      const contact = createContact('c1', gadget)
      
      // Initial signal
      propagate(contact, signal('value1', 0.5))
      expect(contact.signal.value).toBe('value1')
      expect(contact.signal.strength).toBe(5000)
      
      // Stronger signal should replace
      propagate(contact, signal('value2', 0.7))
      expect(contact.signal.value).toBe('value2')
      expect(contact.signal.strength).toBe(7000)
    })
    
    it('should reject weaker signals', () => {
      const gadget = createGadget('test')
      const contact = createContact('c1', gadget)
      
      propagate(contact, signal('strong', 0.8))
      expect(contact.signal.value).toBe('strong')
      
      // Weaker signal should be ignored
      propagate(contact, signal('weak', 0.3))
      expect(contact.signal.value).toBe('strong')
      expect(contact.signal.strength).toBe(8000)
    })
    
    it('should respect hysteresis threshold', () => {
      const gadget = createGadget('test')
      const contact = createContact('c1', gadget)
      
      propagate(contact, signal('first', 0.5))
      
      // Signal within hysteresis (0.5 + 0.01 = 0.51)
      propagate(contact, signal('close', 0.505))
      expect(contact.signal.value).toBe('first')
      
      // Signal beyond hysteresis
      propagate(contact, signal('beyond', 0.52))
      expect(contact.signal.value).toBe('beyond')
    })
  })
  
  describe('Transistor Linear Adjustment', () => {
    let transistor: any
    let input: any
    let control: any
    let output: any
    
    beforeEach(() => {
      transistor = createTransistor('test-trans')
      input = transistor.contacts.get('input')!
      control = transistor.contacts.get('control')!
      output = transistor.contacts.get('output')!
    })
    
    it('should attenuate with negative control', () => {
      propagate(input, signal(42, 0.8))  // 8000 units
      propagate(control, signal(-3000, 1.0))  // Reduce by 3000
      
      expect(output.signal.value).toBe(42)
      expect(output.signal.strength).toBe(5000)  // 8000 - 3000
    })
    
    it('should pass through with zero control', () => {
      propagate(input, signal('data', 0.6))  // 6000 units
      propagate(control, signal(0, 1.0))  // No change
      
      expect(output.signal.value).toBe('data')
      expect(output.signal.strength).toBe(6000)
    })
    
    it('should not amplify without gain', () => {
      expect(transistor.gainPool).toBe(0)
      
      propagate(input, signal('test', 0.5))  // 5000 units
      propagate(control, signal(3000, 1.0))  // Try to boost
      
      // No amplification without gain
      expect(output.signal.strength).toBe(5000)
    })
    
    it('should amplify with available gain', () => {
      transistor.gainPool = 4000  // Add gain
      
      propagate(input, signal('test', 0.5))  // 5000 units
      propagate(control, signal(3000, 1.0))  // Boost by 3000
      
      expect(output.signal.strength).toBe(8000)  // 5000 + 3000
      expect(transistor.gainPool).toBe(1000)  // 4000 - 3000 used
    })
    
    it('should cap amplification at available gain', () => {
      transistor.gainPool = 2000  // Limited gain
      
      propagate(input, signal('test', 0.4))  // 4000 units
      propagate(control, signal(5000, 1.0))  // Want 5000, but only have 2000
      
      expect(output.signal.strength).toBe(6000)  // 4000 + 2000 (capped)
      expect(transistor.gainPool).toBe(0)  // All consumed
    })
    
    it('should mute completely with KILL_SIGNAL', () => {
      propagate(input, signal('important', 0.9))  // 9000 units
      expect(output.signal.strength).toBe(9000)
      
      propagate(control, signal(KILL_SIGNAL, 1.0))
      
      expect(output.signal.value).toBe('important')  // Value preserved
      expect(output.signal.strength).toBe(0)  // Completely muted
    })
    
    it('should generate receipts for gain consumption', () => {
      clearReceipts()
      transistor.gainPool = 5000
      
      propagate(input, signal('test', 0.3))
      propagate(control, signal(2000, 1.0))  // Use 2000 gain
      
      const receipts = getAllReceipts()
      expect(receipts).toHaveLength(1)
      expect(receipts[0].gadgetId).toBe('test-trans')
      expect(receipts[0].amount).toBe(2000)
    })
  })
  
  describe('Primitive Gadgets', () => {
    it('should wait for all inputs before computing', () => {
      const adder = createAdder('test-add')
      const a = adder.contacts.get('a')!
      const b = adder.contacts.get('b')!
      const output = adder.contacts.get('output')!
      
      // Set only one input
      propagate(a, signal(5, 0.8))
      expect(output.signal.value).toBe(null)  // Not computed yet
      
      // Set second input
      propagate(b, signal(3, 0.6))
      expect(output.signal.value).toBe(8)  // Now computed
    })
    
    it('should use MIN strength for outputs', () => {
      const adder = createAdder('test-add')
      const a = adder.contacts.get('a')!
      const b = adder.contacts.get('b')!
      const output = adder.contacts.get('output')!
      
      propagate(a, signal(10, 0.9))  // 9000 units
      propagate(b, signal(5, 0.4))   // 4000 units
      
      expect(output.signal.value).toBe(15)
      expect(output.signal.strength).toBe(4000)  // MIN(9000, 4000)
    })
  })
  
  describe('Wire Propagation', () => {
    it('should forward signals through wires', () => {
      const source = createGadget('source')
      const target = createGadget('target')
      
      const out = createContact('out', source)
      const in1 = createContact('in', target)
      
      source.contacts.set('out', out)
      target.contacts.set('in', in1)
      
      wire(out, in1)
      
      propagate(out, signal('data', 0.7))
      
      expect(in1.signal.value).toBe('data')
      expect(in1.signal.strength).toBe(7000)
    })
    
    it('should handle computed output updates', () => {
      const transistor = createTransistor('trans')
      const receiver = createGadget('recv')
      
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      const output = transistor.contacts.get('output')!
      const recvIn = createContact('in', receiver)
      
      receiver.contacts.set('in', recvIn)
      wire(output, recvIn)
      
      // Set control first to avoid initial propagation
      propagate(control, signal(-2000, 1.0))  // Reduce by 2000
      
      // Now propagate input
      propagate(input, signal('test', 0.8))  // 8000 units
      
      // Output should be computed with control applied
      expect(output.signal.strength).toBe(6000)  // 8000 - 2000
      expect(recvIn.signal.strength).toBe(6000)  // Should match
    })
  })
  
  describe('Integer Strength System', () => {
    it('should handle strength as integers without precision loss', () => {
      const transistor = createTransistor('int-test')
      const input = transistor.contacts.get('input')!
      const control = transistor.contacts.get('control')!
      const output = transistor.contacts.get('output')!
      
      // Test precise values
      propagate(input, signal('data', 0.333))  // 3330 units
      propagate(control, signal(-1110, 1.0))   // Reduce by exactly 1110
      
      expect(output.signal.strength).toBe(2220)  // Exact integer math
      expect(formatStrength(output.signal.strength)).toBe('0.222')
    })
    
    it('should convert between decimal and units correctly', () => {
      expect(toUnits(1.0)).toBe(10000)
      expect(toUnits(0.5)).toBe(5000)
      expect(toUnits(0.333)).toBe(3330)
      expect(toUnits(0.001)).toBe(10)
    })
  })
  
  describe('Trust-based Attenuation Network', () => {
    it('should attenuate untrusted signals', () => {
      const trustGate = createTransistor('trust')
      const input = trustGate.contacts.get('input')!
      const control = trustGate.contacts.get('control')!
      const output = trustGate.contacts.get('output')!
      
      // High strength but untrusted source
      propagate(input, signal('untrusted-data', 1.0))
      
      // Apply strong attenuation (90% reduction)
      propagate(control, signal(-9000, 1.0))
      
      expect(output.signal.value).toBe('untrusted-data')
      expect(output.signal.strength).toBe(1000)  // 10% of original
    })
    
    it('should gradually increase trust', () => {
      const trustGate = createTransistor('trust')
      const input = trustGate.contacts.get('input')!
      const control = trustGate.contacts.get('control')!
      const output = trustGate.contacts.get('output')!
      
      propagate(input, signal('data', 1.0))  // 10000 units
      
      // Start with high attenuation
      propagate(control, signal(-9000, 1.0))
      expect(output.signal.strength).toBe(1000)  // 10%
      
      // Increase trust (less attenuation)
      propagate(control, signal(-5000, 1.1))
      expect(output.signal.strength).toBe(5000)  // 50%
      
      // Full trust (no attenuation)
      propagate(control, signal(0, 1.2))
      expect(output.signal.strength).toBe(10000)  // 100%
    })
  })
  
  describe('Path Competition', () => {
    it('should allow gradual drowning via linear adjustment', () => {
      const pathA = createTransistor('path-a')
      const pathB = createTransistor('path-b')
      
      // Give path B gain for amplification
      pathB.gainPool = 5000
      
      const inA = pathA.contacts.get('input')!
      const inB = pathB.contacts.get('input')!
      const ctrlA = pathA.contacts.get('control')!
      const ctrlB = pathB.contacts.get('control')!
      const outA = pathA.contacts.get('output')!
      const outB = pathB.contacts.get('output')!
      
      // Both start equal
      propagate(inA, signal('A', 0.5))
      propagate(inB, signal('B', 0.5))
      propagate(ctrlA, signal(0, 1.0))
      propagate(ctrlB, signal(0, 1.0))
      
      expect(outA.signal.strength).toBe(5000)
      expect(outB.signal.strength).toBe(5000)
      
      // Boost B to win
      propagate(ctrlB, signal(2000, 1.1))  // +2000
      expect(outB.signal.strength).toBe(7000)
      
      // Attenuate A (free, no gain needed)
      propagate(ctrlA, signal(-2000, 1.2))  // -2000
      expect(outA.signal.strength).toBe(3000)
      
      // B beats A: 7000 > 3000
      expect(outB.signal.strength).toBeGreaterThan(outA.signal.strength)
      expect(pathB.gainPool).toBe(3000)  // 5000 - 2000 used
    })
  })
})