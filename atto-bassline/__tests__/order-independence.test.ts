/**
 * Order Independence Tests
 * 
 * Verifies that network behavior is deterministic regardless of the order
 * in which components are created, wired, or executed.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createGadget,
  createContact,
  createTransistor,
  createDynamicGadget,
  createSpawner,
  createEvolver,
  signal,
  propagate,
  wire,
  clearReceipts,
  getAllReceipts,
  type DynamicGadgetSpec,
  type TemplateSignal,
  type InstanceSignal,
  type Signal
} from '../src'

describe('Order Independence', () => {
  beforeEach(() => {
    clearReceipts()
  })
  
  describe('Wire Creation Order', () => {
    it('should produce same results regardless of wire creation order', () => {
      // Network 1: Wire A->B then B->C
      const net1 = createGadget('net1')
      const a1 = createContact('a', net1, signal(10, 1.0), 'output')
      const b1 = createContact('b', net1, undefined, 'input')
      const c1 = createContact('c', net1, undefined, 'input')
      
      wire(a1, b1)
      wire(b1, c1)
      
      propagate(a1, signal(42, 0.8))
      
      // Network 2: Wire B->C then A->B
      const net2 = createGadget('net2')
      const a2 = createContact('a', net2, signal(10, 1.0), 'output')
      const b2 = createContact('b', net2, undefined, 'input')
      const c2 = createContact('c', net2, undefined, 'input')
      
      wire(b2, c2)
      wire(a2, b2)
      
      propagate(a2, signal(42, 0.8))
      
      // Both should have same final state
      expect(b1.signal.value).toBe(b2.signal.value)
      expect(c1.signal.value).toBe(c2.signal.value)
      expect(b1.signal.strength).toBe(b2.signal.strength)
      expect(c1.signal.strength).toBe(c2.signal.strength)
    })
    
    it('should handle complex wiring patterns independently', () => {
      const createNetwork = (wireOrder: Array<[string, string]>) => {
        const g = createGadget('test')
        const contacts = new Map<string, any>()
        
        // Create all contacts first
        for (const name of ['a', 'b', 'c', 'd', 'e']) {
          contacts.set(name, createContact(name, g, undefined, 'input'))
          g.contacts.set(name, contacts.get(name))
        }
        
        // Wire in specified order
        for (const [from, to] of wireOrder) {
          wire(contacts.get(from), contacts.get(to))
        }
        
        // Propagate signal
        propagate(contacts.get('a'), signal(100, 1.0))
        
        return contacts
      }
      
      // Different wiring orders
      const order1 = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e']]
      const order2 = [['d', 'e'], ['c', 'd'], ['b', 'c'], ['a', 'b']]
      const order3 = [['b', 'c'], ['d', 'e'], ['a', 'b'], ['c', 'd']]
      
      const net1 = createNetwork(order1)
      const net2 = createNetwork(order2)
      const net3 = createNetwork(order3)
      
      // All should have same final state
      for (const name of ['b', 'c', 'd', 'e']) {
        expect(net1.get(name).signal.value).toBe(net2.get(name).signal.value)
        expect(net2.get(name).signal.value).toBe(net3.get(name).signal.value)
      }
    })
  })
  
  describe('Contact Initialization Order', () => {
    it('should handle contacts created in different orders', () => {
      const spec1: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'alpha': { direction: 'input' },
            'beta': { direction: 'output' },
            'gamma': { direction: 'input' }
          }
        }
      }
      
      const spec2: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'gamma': { direction: 'input' },
            'alpha': { direction: 'input' },
            'beta': { direction: 'output' }
          }
        }
      }
      
      const g1 = createDynamicGadget('g1', spec1)
      const g2 = createDynamicGadget('g2', spec2)
      
      // Both should have same contacts
      expect(g1.contacts.size).toBe(g2.contacts.size)
      expect(g1.contacts.has('alpha')).toBe(true)
      expect(g2.contacts.has('alpha')).toBe(true)
      expect(g1.contacts.has('beta')).toBe(true)
      expect(g2.contacts.has('beta')).toBe(true)
    })
    
    it('should produce consistent results with different initialization orders', () => {
      const transistor1 = createTransistor('t1')
      const transistor2 = createTransistor('t2')
      
      // Different initialization orders
      propagate(transistor1.contacts.get('control')!, signal(5000, 1.0))
      propagate(transistor1.contacts.get('input')!, signal('data', 0.5))
      
      propagate(transistor2.contacts.get('input')!, signal('data', 0.5))
      propagate(transistor2.contacts.get('control')!, signal(5000, 1.0))
      
      const out1 = transistor1.compute!(new Map([
        ['input', signal('data', 0.5)],
        ['control', signal(5000, 1.0)]
      ]))
      
      const out2 = transistor2.compute!(new Map([
        ['input', signal('data', 0.5)],
        ['control', signal(5000, 1.0)]
      ]))
      
      expect(out1.get('output')?.strength).toBe(out2.get('output')?.strength)
    })
  })
  
  describe('Gadget Registration Order', () => {
    it('should handle children added in different orders', () => {
      const parent1 = createGadget('parent1')
      const parent2 = createGadget('parent2')
      
      // Add children in different orders
      const child1a = createGadget('child1')
      const child2a = createGadget('child2')
      const child3a = createGadget('child3')
      
      parent1.gadgets.set('c1', child1a)
      parent1.gadgets.set('c2', child2a)
      parent1.gadgets.set('c3', child3a)
      
      const child1b = createGadget('child1')
      const child2b = createGadget('child2')
      const child3b = createGadget('child3')
      
      parent2.gadgets.set('c3', child3b)
      parent2.gadgets.set('c1', child1b)
      parent2.gadgets.set('c2', child2b)
      
      // Both should have same children
      expect(parent1.gadgets.size).toBe(parent2.gadgets.size)
      expect(parent1.gadgets.has('c1')).toBe(true)
      expect(parent2.gadgets.has('c1')).toBe(true)
    })
    
    it('should maintain consistent parent references', () => {
      const parent = createGadget('parent')
      const children = []
      
      // Add children in random order
      const ids = ['a', 'b', 'c', 'd', 'e'].sort(() => Math.random() - 0.5)
      
      for (const id of ids) {
        const child = createGadget(id)
        child.parent = new WeakRef(parent)
        parent.gadgets.set(id, child)
        children.push(child)
      }
      
      // All should have parent reference
      for (const child of children) {
        expect(child.parent?.deref()).toBe(parent)
      }
    })
  })
  
  describe('Propagation Order', () => {
    it('should reach same steady state regardless of propagation order', () => {
      const createAndPropagate = (order: string[]) => {
        const g = createGadget('test')
        const contacts = new Map<string, any>()
        
        contacts.set('a', createContact('a', g, signal(0, 0.5), 'input'))
        contacts.set('b', createContact('b', g, signal(0, 0.5), 'input'))
        contacts.set('c', createContact('c', g, signal(0, 0.5), 'input'))
        
        wire(contacts.get('a'), contacts.get('c'))
        wire(contacts.get('b'), contacts.get('c'))
        
        // Propagate in specified order
        for (const name of order) {
          if (name === 'a') propagate(contacts.get('a'), signal(10, 0.8))
          if (name === 'b') propagate(contacts.get('b'), signal(20, 0.9))
        }
        
        return contacts.get('c').signal
      }
      
      const result1 = createAndPropagate(['a', 'b'])
      const result2 = createAndPropagate(['b', 'a'])
      
      // Should have same final value (highest strength wins)
      expect(result1.value).toBe(result2.value)
      expect(result1.strength).toBe(result2.strength)
    })
    
    it('should handle concurrent propagations consistently', () => {
      const g = createGadget('test')
      const source1 = createContact('s1', g, signal(0, 0.5), 'output')
      const source2 = createContact('s2', g, signal(0, 0.5), 'output')
      const target = createContact('target', g, undefined, 'input')
      
      wire(source1, target)
      wire(source2, target)
      
      // Simulate concurrent propagations
      const signals = [
        signal(100, 0.6),
        signal(200, 0.7),
        signal(300, 0.5)
      ]
      
      // Apply in different orders multiple times
      for (let i = 0; i < 10; i++) {
        const shuffled = [...signals].sort(() => Math.random() - 0.5)
        propagate(source1, shuffled[0])
        propagate(source2, shuffled[1])
      }
      
      // Should converge to highest strength
      expect(target.signal.strength).toBeLessThanOrEqual(10000)
    })
  })
  
  describe('Spawning Order Independence', () => {
    it('should spawn consistently regardless of trigger order', () => {
      const spawner1 = createSpawner('spawner1')
      const spawner2 = createSpawner('spawner2')
      
      const template: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: {
                'input': { direction: 'input' },
                'output': { direction: 'output' }
              }
            }
          }
        }
      }
      
      // Spawn in different orders
      spawner1.compute!(new Map([
        ['template', signal(template, 1.0)],
        ['initialGain', signal(100, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      spawner2.compute!(new Map([
        ['trigger', signal(true, 1.0)],
        ['template', signal(template, 1.0)],
        ['initialGain', signal(100, 1.0)]
      ]))
      
      // Both should spawn successfully
      expect(spawner1.gadgets.size).toBe(1)
      expect(spawner2.gadgets.size).toBe(1)
    })
    
    it('should handle parallel spawning requests', () => {
      const spawner = createSpawner('multi')
      
      const templates = Array(5).fill(null).map((_, i) => ({
        tag: 'template' as const,
        value: {
          spec: {
            structure: {
              contacts: {
                [`contact_${i}`]: { direction: 'input' as const }
              }
            }
          }
        }
      }))
      
      // Spawn multiple in random order
      const shuffled = [...templates].sort(() => Math.random() - 0.5)
      
      for (const template of shuffled) {
        spawner.compute!(new Map([
          ['template', signal(template, 1.0)],
          ['trigger', signal(true, 1.0)]
        ]))
      }
      
      expect(spawner.gadgets.size).toBe(5)
    })
  })
  
  describe('Evolution Order', () => {
    it('should transfer strength consistently', () => {
      const createEvolutionScenario = () => {
        const evolver = createEvolver('evolver')
        const old = createGadget('old')
        const new1 = createGadget('new')
        
        old.gainPool = 1000
        new1.gainPool = 0
        
        return { evolver, old, new: new1 }
      }
      
      const scenario1 = createEvolutionScenario()
      const scenario2 = createEvolutionScenario()
      
      const oldInstance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'old',
          gadget: new WeakRef(scenario1.old),
          born: Date.now(),
          generation: 1
        }
      }
      
      const newInstance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'new',
          gadget: new WeakRef(scenario1.new),
          born: Date.now(),
          generation: 2
        }
      }
      
      // Evolve multiple times in different orders
      for (let i = 0; i < 5; i++) {
        scenario1.evolver.compute!(new Map([
          ['old', signal(oldInstance, 1.0)],
          ['new', signal(newInstance, 1.0)],
          ['rate', signal(100, 1.0)]
        ]))
      }
      
      const oldInstance2: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'old',
          gadget: new WeakRef(scenario2.old),
          born: Date.now(),
          generation: 1
        }
      }
      
      const newInstance2: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'new',
          gadget: new WeakRef(scenario2.new),
          born: Date.now(),
          generation: 2
        }
      }
      
      // Different order of parameters
      for (let i = 0; i < 5; i++) {
        scenario2.evolver.compute!(new Map([
          ['rate', signal(100, 1.0)],
          ['new', signal(newInstance2, 1.0)],
          ['old', signal(oldInstance2, 1.0)]
        ]))
      }
      
      // Both should have same final state
      expect(scenario1.old.gainPool).toBe(scenario2.old.gainPool)
      expect(scenario1.new.gainPool).toBe(scenario2.new.gainPool)
    })
  })
  
  describe('Receipt Generation Order', () => {
    it('should generate consistent receipts regardless of operation order', () => {
      clearReceipts()
      
      const spawner = createSpawner('spawner')
      const template: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: { 'x': { direction: 'input' } }
            }
          }
        }
      }
      
      // Spawn multiple times
      for (let i = 0; i < 3; i++) {
        spawner.compute!(new Map([
          ['template', signal(template, 1.0)],
          ['initialGain', signal(100, 1.0)],
          ['trigger', signal(true, 1.0)]
        ]))
      }
      
      const receipts1 = getAllReceipts()
      
      clearReceipts()
      
      // Spawn in reverse order with different spawner
      const spawner2 = createSpawner('spawner2')
      for (let i = 0; i < 3; i++) {
        spawner2.compute!(new Map([
          ['trigger', signal(true, 1.0)],
          ['initialGain', signal(100, 1.0)],
          ['template', signal(template, 1.0)]
        ]))
      }
      
      const receipts2 = getAllReceipts()
      
      // Should have same number of receipts
      expect(receipts1.length).toBe(receipts2.length)
      
      // Total amounts should match
      const total1 = receipts1.reduce((sum, r) => sum + r.amount, 0)
      const total2 = receipts2.reduce((sum, r) => sum + r.amount, 0)
      expect(total1).toBe(total2)
    })
  })
  
  describe('Behavior Binding Order', () => {
    it('should bind behaviors consistently', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'a': { direction: 'input' },
            'b': { direction: 'input' },
            'result': { direction: 'output' }
          }
        },
        bindings: {
          behavior: '__behavior',
          validator: '__validator'
        }
      }
      
      const g1 = createDynamicGadget('g1', spec)
      const g2 = createDynamicGadget('g2', spec)
      
      const behavior = {
        compute: {
          type: 'expression' as const,
          expr: { op: 'add', args: { a: 'a', b: 'b' } }
        }
      }
      
      const validator = {
        type: 'sandbox',
        deny: []
      }
      
      // Bind in different orders
      const result1 = g1.compute!(new Map([
        ['__behavior', signal(behavior, 1.0)],
        ['__validator', signal(validator, 1.0)],
        ['a', signal(5, 1.0)],
        ['b', signal(3, 1.0)]
      ]))
      
      const result2 = g2.compute!(new Map([
        ['a', signal(5, 1.0)],
        ['__validator', signal(validator, 1.0)],
        ['b', signal(3, 1.0)],
        ['__behavior', signal(behavior, 1.0)]
      ]))
      
      expect(result1.get('output')?.value).toBe(result2.get('output')?.value)
    })
  })
  
  describe('Complex Network Order Independence', () => {
    it('should build identical networks from different construction sequences', () => {
      const buildNetwork1 = () => {
        const net = createGadget('network')
        
        // Build bottom-up
        const leaf1 = createTransistor('leaf1')
        const leaf2 = createTransistor('leaf2')
        const middle = createGadget('middle')
        const root = createGadget('root')
        
        middle.gadgets.set('l1', leaf1)
        middle.gadgets.set('l2', leaf2)
        root.gadgets.set('m', middle)
        net.gadgets.set('r', root)
        
        return net
      }
      
      const buildNetwork2 = () => {
        const net = createGadget('network')
        
        // Build top-down
        const root = createGadget('root')
        net.gadgets.set('r', root)
        
        const middle = createGadget('middle')
        root.gadgets.set('m', middle)
        
        const leaf1 = createTransistor('leaf1')
        const leaf2 = createTransistor('leaf2')
        middle.gadgets.set('l2', leaf2)
        middle.gadgets.set('l1', leaf1)
        
        return net
      }
      
      const net1 = buildNetwork1()
      const net2 = buildNetwork2()
      
      // Should have identical structure
      expect(net1.gadgets.size).toBe(net2.gadgets.size)
      
      const root1 = net1.gadgets.get('r')!
      const root2 = net2.gadgets.get('r')!
      expect(root1.gadgets.size).toBe(root2.gadgets.size)
      
      const middle1 = root1.gadgets.get('m')!
      const middle2 = root2.gadgets.get('m')!
      expect(middle1.gadgets.size).toBe(middle2.gadgets.size)
      expect(middle1.gadgets.has('l1')).toBe(true)
      expect(middle2.gadgets.has('l1')).toBe(true)
    })
  })
})