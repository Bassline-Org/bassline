/**
 * Propagation Stability Tests
 * 
 * Tests for signal flow correctness, strength conservation,
 * and stable propagation patterns under various conditions.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createGadget,
  createContact,
  createTransistor,
  createDynamicGadget,
  signal,
  propagate,
  wire,
  clearReceipts,
  type Signal,
  type DynamicGadgetSpec,
  type BehaviorSpec
} from '../src'

describe('Propagation Stability', () => {
  beforeEach(() => {
    clearReceipts()
  })
  
  describe('Strength Conservation', () => {
    it('should not amplify strength beyond limits', () => {
      const g = createGadget('conservation')
      // Start source below max so it can be updated
      const source = createContact('source', g, signal(0, 0.5), 'output')
      const target = createContact('target', g, signal(0, 0.1), 'input')
      
      g.contacts.set('source', source)
      g.contacts.set('target', target)
      
      wire(source, target)
      
      // Propagate max strength to source
      propagate(source, signal('max', 1.0))
      
      // Source updated from 0.5 to 1.0, should forward to target
      expect(source.signal.strength).toBe(10000)
      
      // The wire forwarding happens automatically when source is updated
      // Since target had 0.1 (1000) and receives 1.0 (10000), it updates
      for (const targetRef of source.targets) {
        const t = targetRef.deref()
        if (t === target) {
          // Wire should have forwarded the signal
          expect(target.signal.strength).toBe(10000)
        }
      }
      
      // Further propagation with same strength won't change source
      // and therefore won't forward through wire
      for (let i = 0; i < 10; i++) {
        propagate(source, signal('more', 1.0))
      }
      
      // Everything stays at max
      expect(source.signal.strength).toBe(10000)
      expect(target.signal.strength).toBe(10000)
    })
    
    it('should maintain strength ratios in chains', () => {
      const g = createGadget('chain')
      const contacts = []
      
      // Create chain of contacts
      for (let i = 0; i < 5; i++) {
        const c = createContact(`c${i}`, g, signal(0, 0.5), 'input')
        g.contacts.set(`c${i}`, c)
        contacts.push(c)
      }
      
      // Wire in sequence
      for (let i = 0; i < contacts.length - 1; i++) {
        wire(contacts[i], contacts[i + 1])
      }
      
      // Propagate through chain
      propagate(contacts[0], signal('chain', 0.8))
      
      // Each should maintain or reduce strength
      for (let i = 1; i < contacts.length; i++) {
        expect(contacts[i].signal.strength).toBeLessThanOrEqual(8000)
      }
    })
    
    it('should handle transistor amplification limits', () => {
      const t = createTransistor('amp')
      t.gainPool = 100000
      
      // Maximum amplification attempt
      const inputs = new Map([
        ['input', signal('data', 0.1)], // Weak input (1000 units)
        ['control', signal(200000, 1.0)] // Try to amplify beyond max
      ])
      
      const outputs = t.compute!(inputs)
      
      // Output should be capped at system max (100000)
      expect(outputs.get('output')?.strength).toBeLessThanOrEqual(100000)
    })
  })
  
  describe('Signal Merging', () => {
    it('should merge signals by strength consistently', () => {
      const g = createGadget('merge')
      const target = createContact('target', g, signal(null, 0.1), 'input')
      g.contacts.set('target', target)
      
      const sources = []
      const strengths = [0.3, 0.7, 0.5, 0.9, 0.2]
      
      for (let i = 0; i < 5; i++) {
        const s = createContact(`s${i}`, g, signal(i, strengths[i]), 'output')
        g.contacts.set(`s${i}`, s)
        sources.push(s)
        wire(s, target)
      }
      
      // Propagate all to target through wires
      for (let i = 0; i < sources.length; i++) {
        // Sources already have their values, propagate to target
        propagate(target, signal(i, strengths[i]))
      }
      
      // Strongest should win
      expect(target.signal.value).toBe(3) // Index 3 has 0.9 strength
      expect(target.signal.strength).toBe(9000)
    })
    
    it('should handle simultaneous equal-strength signals', () => {
      const g = createGadget('equal')
      const target = createContact('target', g, signal(null, 0.1), 'input')
      
      const s1 = createContact('s1', g, signal('first', 0.5), 'output')
      const s2 = createContact('s2', g, signal('second', 0.5), 'output')
      
      g.contacts.set('target', target)
      g.contacts.set('s1', s1)
      g.contacts.set('s2', s2)
      
      wire(s1, target)
      wire(s2, target)
      
      // First signal sets the value
      propagate(target, signal('first', 0.5))
      expect(target.signal.value).toBe('first')
      
      // Equal strength with different value = contradiction
      propagate(target, signal('second', 0.5))
      const value = target.signal.value as any
      expect(value.tag).toBe('contradiction')
      
      // Stronger signal resolves contradiction
      propagate(target, signal('resolved', 0.6))
      expect(target.signal.value).toBe('resolved')
    })
    
    it('should accumulate strength properly', () => {
      const g = createGadget('accumulate')
      const target = createContact('target', g, signal(0, 0.05), 'input')
      
      // Multiple weak sources
      const sources = []
      for (let i = 0; i < 10; i++) {
        const s = createContact(`s${i}`, g, signal(0, 0.05), 'output')
        sources.push(s)
        wire(s, target)
      }
      
      // All propagate same weak signal (stronger than initial)
      for (const s of sources) {
        propagate(s, signal('weak', 0.1))
      }
      
      // Should take strongest (not accumulate)
      expect(target.signal.strength).toBe(1000)
      expect(target.signal.value).toBe('weak')
    })
  })
  
  describe('Wire Disconnection', () => {
    it('should handle wire removal during propagation', () => {
      const g = createGadget('disconnect')
      const source = createContact('source', g, signal(0, 0.5), 'output')
      const target = createContact('target', g, signal(0, 0.5), 'input')
      
      g.contacts.set('source', source)
      g.contacts.set('target', target)
      
      wire(source, target)
      
      // Propagate once
      propagate(source, signal('connected', 0.8))
      expect(target.signal.value).toBe('connected')
      
      // Disconnect
      source.targets.clear()
      target.sources.clear()
      
      // Propagate again
      propagate(source, signal('disconnected', 0.9))
      
      // Target shouldn't update
      expect(target.signal.value).toBe('connected')
    })
    
    it('should handle partial disconnection in fan-out', () => {
      const g = createGadget('partial')
      const source = createContact('source', g, signal(0, 0.5), 'output')
      
      const targets = []
      for (let i = 0; i < 5; i++) {
        const t = createContact(`t${i}`, g, signal(0, 0.1), 'input')
        targets.push(t)
        wire(source, t)
      }
      
      // Disconnect some targets
      const disconnected = [targets[1], targets[3]]
      for (const t of disconnected) {
        source.targets.forEach(ref => {
          if (ref.deref() === t) {
            source.targets.delete(ref)
          }
        })
      }
      
      // Propagate
      propagate(source, signal('partial', 0.7))
      
      // Connected targets should update
      expect(targets[0].signal.value).toBe('partial')
      expect(targets[2].signal.value).toBe('partial')
      expect(targets[4].signal.value).toBe('partial')
      
      // Disconnected shouldn't
      expect(targets[1].signal.value).toBe(0)
      expect(targets[3].signal.value).toBe(0)
    })
  })
  
  describe('Contact Deletion Mid-Propagation', () => {
    it('should handle contact deletion gracefully', () => {
      const g = createGadget('deletion')
      const source = createContact('source', g, signal(0, 0.5), 'output')
      const middle = createContact('middle', g, signal(0, 0.5), 'input')
      const target = createContact('target', g, signal(0, 0.5), 'input')
      
      g.contacts.set('source', source)
      g.contacts.set('middle', middle)
      g.contacts.set('target', target)
      
      wire(source, middle)
      wire(middle, target)
      
      // Start propagation
      propagate(source, signal('test', 0.8))
      
      // Delete middle contact
      g.contacts.delete('middle')
      
      // Target might or might not receive signal
      // But shouldn't crash
      expect(g.contacts.size).toBe(2)
    })
    
    it('should handle gadget deletion during propagation', () => {
      const parent = createGadget('parent')
      const child = createGadget('child')
      
      parent.gadgets.set('child', child)
      
      const parentOut = createContact('out', parent, signal(0, 0.5), 'output')
      const childIn = createContact('in', child, signal(0, 0.5), 'input')
      
      parent.contacts.set('out', parentOut)
      child.contacts.set('in', childIn)
      
      wire(parentOut, childIn)
      
      // Propagate
      propagate(parentOut, signal('orphan', 0.7))
      
      // Delete child
      parent.gadgets.delete('child')
      
      // Shouldn't crash
      expect(parent.gadgets.size).toBe(0)
    })
  })
  
  describe('Concurrent Propagation', () => {
    it('should handle race conditions in propagation', () => {
      const g = createGadget('race')
      const target = createContact('target', g, signal(null, 0.1), 'input')
      
      const fast = createContact('fast', g, signal(0, 0.5), 'output')
      const slow = createContact('slow', g, signal(0, 0.5), 'output')
      
      wire(fast, target)
      wire(slow, target)
      
      // Simulate concurrent propagation
      const signals: Signal[] = [
        signal('fast', 0.9),
        signal('slow', 0.8)
      ]
      
      // Random order execution
      const shuffled = [...signals].sort(() => Math.random() - 0.5)
      
      propagate(fast, shuffled[0])
      propagate(slow, shuffled[1])
      
      // Both sources update and forward to target
      // The stronger signal should win at the target
      expect(target.signal.value).toBe('fast')
      expect(target.signal.strength).toBe(9000)
    })
    
    it('should maintain consistency with parallel updates', () => {
      const g = createGadget('parallel')
      
      const contacts = []
      for (let i = 0; i < 10; i++) {
        const c = createContact(`c${i}`, g, signal(0, 0.1), 'input')
        contacts.push(c)
      }
      
      // Update all in "parallel" (rapid sequence)
      for (let i = 0; i < contacts.length; i++) {
        propagate(contacts[i], signal(i, (i + 1) / 10))
      }
      
      // Each should have its value
      for (let i = 0; i < contacts.length; i++) {
        expect(contacts[i].signal.value).toBe(i)
      }
    })
  })
  
  describe('Contradiction Flow', () => {
    it('should propagate contradictions as signals', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'input': { direction: 'input' },
            'output': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('contradiction', spec)
      
      // Behavior that produces contradiction
      const contradictoryBehavior: BehaviorSpec = {
        compute: {
          type: 'expression',
          expr: {
            op: 'constant',
            args: {
              value: { tag: 'contradiction', value: 'conflict detected' },
              strength: 10000
            }
          }
        }
      }
      
      const result = gadget.compute!(new Map([
        ['__behavior', signal(contradictoryBehavior, 1.0)]
      ]))
      
      const output = result.get('output')?.value as any
      expect(output?.tag).toBe('contradiction')
      expect(output?.value).toBe('conflict detected')
    })
    
    it('should handle contradiction merging', () => {
      const g = createGadget('contra-merge')
      const target = createContact('target', g, signal(null, 0.1), 'input')
      
      const normal = createContact('normal', g, signal(0, 0.3), 'output')
      const contra = createContact('contra', g, signal(0, 0.3), 'output')
      
      wire(normal, target)
      wire(contra, target)
      
      propagate(normal, signal('data', 0.5))
      propagate(contra, signal({ tag: 'contradiction', value: 'error' }, 0.7))
      
      // Contradiction with higher strength should win
      const targetValue = target.signal.value as any
      expect(targetValue?.tag).toBe('contradiction')
    })
  })
  
  describe('Propagation Patterns', () => {
    it('should handle diamond propagation pattern', () => {
      const g = createGadget('diamond')
      
      //     source
      //     /    \
      //   left  right  (intermediate nodes that forward)
      //     \    /
      //     target
      
      const source = createContact('source', g, signal(0, 0.5), 'output')
      
      // Create intermediate gadgets for left and right paths
      const leftGadget = createGadget('left')
      const leftIn = createContact('in', leftGadget, signal(0, 0.3), 'input')
      const leftOut = createContact('out', leftGadget, signal(0, 0.3), 'output')
      leftGadget.contacts.set('in', leftIn)
      leftGadget.contacts.set('out', leftOut)
      wire(leftIn, leftOut)  // Forward signal through
      
      const rightGadget = createGadget('right')
      const rightIn = createContact('in', rightGadget, signal(0, 0.3), 'input')
      const rightOut = createContact('out', rightGadget, signal(0, 0.3), 'output')
      rightGadget.contacts.set('in', rightIn)
      rightGadget.contacts.set('out', rightOut)
      wire(rightIn, rightOut)  // Forward signal through
      
      const target = createContact('target', g, signal(0, 0.1), 'input')
      
      g.contacts.set('source', source)
      g.contacts.set('target', target)
      g.gadgets.set('left', leftGadget)
      g.gadgets.set('right', rightGadget)
      
      // Wire the diamond
      wire(source, leftIn)
      wire(source, rightIn)
      wire(leftOut, target)
      wire(rightOut, target)
      
      // Propagate from source
      propagate(source, signal('diamond', 0.8))
      
      // Should reach intermediate nodes
      expect(leftIn.signal.value).toBe('diamond')
      expect(rightIn.signal.value).toBe('diamond')
      
      // And eventually target (through the stronger of the two paths)
      expect(target.signal.value).toBe('diamond')
    })
    
    it('should handle tree propagation pattern', () => {
      const root = createGadget('tree')
      const rootOut = createContact('root', root, signal(0, 0.5), 'output')
      root.contacts.set('root', rootOut)
      
      // Build tree structure
      const levels = []
      let currentLevel = [rootOut]
      
      for (let level = 0; level < 3; level++) {
        const nextLevel = []
        
        for (const parent of currentLevel) {
          for (let i = 0; i < 2; i++) {
            const child = createContact(`l${level}_${i}`, root, signal(0, 0.1), 'input')
            root.contacts.set(`l${level}_${i}`, child)
            wire(parent, child)
            nextLevel.push(child)
          }
        }
        
        levels.push(nextLevel)
        currentLevel = nextLevel
      }
      
      // Propagate from root
      propagate(rootOut, signal('tree', 0.9))
      
      // All leaves should receive
      for (const level of levels) {
        for (const node of level) {
          expect(node.signal.value).toBe('tree')
        }
      }
    })
    
    it('should handle mesh propagation pattern', () => {
      const g = createGadget('mesh')
      
      // Create mesh of interconnected nodes
      const nodes = []
      for (let i = 0; i < 5; i++) {
        const n = createContact(`n${i}`, g, signal(i, 0.2), 'input')
        nodes.push(n)
      }
      
      // Connect each to several others (not all)
      wire(nodes[0], nodes[1])
      wire(nodes[0], nodes[3])
      wire(nodes[1], nodes[2])
      wire(nodes[1], nodes[4])
      wire(nodes[2], nodes[3])
      wire(nodes[3], nodes[4])
      wire(nodes[4], nodes[0]) // Back edge
      
      // Propagate from one node
      propagate(nodes[0], signal('mesh', 0.8))
      
      // Should spread through mesh
      expect(nodes[1].signal.value).toBe('mesh')
      expect(nodes[3].signal.value).toBe('mesh')
    })
  })
  
  describe('Strength Attenuation', () => {
    it('should attenuate strength through transistors', () => {
      const t = createTransistor('attenuate')
      t.gainPool = 1000
      
      // Negative control attenuates
      const inputs = new Map([
        ['input', signal('data', 0.8)],
        ['control', signal(-3000, 1.0)] // 30% attenuation
      ])
      
      const outputs = t.compute!(inputs)
      
      // Should be weaker
      expect(outputs.get('output')?.strength).toBe(5000) // 8000 - 3000
    })
    
    it('should handle cascading attenuation', () => {
      const chain = []
      
      for (let i = 0; i < 3; i++) {
        const t = createTransistor(`t${i}`)
        t.gainPool = 1000
        chain.push(t)
      }
      
      // Each attenuates by 20%
      for (const t of chain) {
        propagate(t.contacts.get('control')!, signal(-2000, 1.0))
      }
      
      // Start with strong signal
      propagate(chain[0].contacts.get('input')!, signal('cascade', 1.0))
      
      // Process through chain
      let currentStrength = 10000
      
      for (const t of chain) {
        const result = t.compute!(new Map([
          ['input', signal('cascade', currentStrength / 10000)],
          ['control', signal(-2000, 1.0)]
        ]))
        
        currentStrength = result.get('output')?.strength || 0
      }
      
      // Should be significantly attenuated
      expect(currentStrength).toBeLessThan(10000)
    })
  })
  
  describe('Feedback Stability', () => {
    it('should stabilize positive feedback loops', () => {
      const g = createGadget('feedback')
      const a = createContact('a', g, signal(1, 0.5), 'input')
      const b = createContact('b', g, signal(0, 0.5), 'input')
      
      // Create positive feedback
      wire(a, b)
      wire(b, a)
      
      // Inject signal
      propagate(a, signal(10, 0.6))
      
      // Should stabilize, not oscillate infinitely
      expect(a.signal.value).toBe(10)
      expect(b.signal.value).toBe(10)
      
      // Further propagation shouldn't change
      propagate(b, signal(10, 0.6))
      
      expect(a.signal.value).toBe(10)
    })
    
    it('should handle negative feedback loops', () => {
      const t1 = createTransistor('neg1')
      const t2 = createTransistor('neg2')
      
      t1.gainPool = 1000
      t2.gainPool = 1000
      
      // Set up negative feedback
      wire(t1.contacts.get('output')!, t2.contacts.get('input')!)
      wire(t2.contacts.get('output')!, t1.contacts.get('control')!)
      
      // Both invert
      propagate(t1.contacts.get('control')!, signal(-5000, 1.0))
      propagate(t2.contacts.get('control')!, signal(-5000, 1.0))
      
      // Inject signal
      propagate(t1.contacts.get('input')!, signal('feedback', 0.5))
      
      // Should reach some stable state
      const out1 = t1.compute!(new Map([
        ['input', signal('feedback', 0.5)],
        ['control', t1.contacts.get('control')!.signal]
      ]))
      
      const out2 = t2.compute!(new Map([
        ['input', out1.get('output')!],
        ['control', t2.contacts.get('control')!.signal]
      ]))
      
      // System should produce outputs without crashing
      expect(out1.get('output')).toBeDefined()
      expect(out2.get('output')).toBeDefined()
    })
  })
})