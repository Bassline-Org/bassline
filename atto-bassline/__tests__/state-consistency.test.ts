/**
 * State Consistency Tests
 * 
 * Verifies that the system maintains consistent state and produces
 * deterministic results given the same inputs.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createGadget,
  createContact,
  createTransistor,
  createDynamicGadget,
  createSpawner,
  provideSpawnerGain,
  createEvolver,
  signal,
  propagate,
  wire,
  clearReceipts,
  getAllReceipts,
  type DynamicGadgetSpec,
  type TemplateSignal,
  type InstanceSignal,
  type BehaviorSpec,
  type Signal
} from '../src'

describe('State Consistency', () => {
  beforeEach(() => {
    clearReceipts()
  })
  
  describe('Deterministic Computation', () => {
    it('should produce identical results for identical inputs', () => {
      const runComputation = () => {
        const t = createTransistor('test')
        t.gainPool = 1000
        
        const inputs = new Map([
          ['input', signal('data', 0.5)],
          ['control', signal(5000, 1.0)]
        ])
        
        return t.compute!(inputs)
      }
      
      const result1 = runComputation()
      const result2 = runComputation()
      const result3 = runComputation()
      
      // All should be identical
      expect(result1.get('output')?.value).toBe(result2.get('output')?.value)
      expect(result2.get('output')?.value).toBe(result3.get('output')?.value)
      expect(result1.get('output')?.strength).toBe(result2.get('output')?.strength)
      expect(result2.get('output')?.strength).toBe(result3.get('output')?.strength)
    })
    
    it('should maintain state consistency across multiple computes', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'counter': { direction: 'input', initial: { value: 0, strength: 1.0 } },
            'increment': { direction: 'input' },
            'result': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('stateful', spec)
      
      const behavior: BehaviorSpec = {
        compute: {
          type: 'expression',
          expr: {
            op: 'add',
            args: {
              a: 'counter',
              b: 'increment'
            }
          }
        }
      }
      
      // Multiple computes with same behavior
      const results = []
      for (let i = 0; i < 5; i++) {
        const result = gadget.compute!(new Map([
          ['__behavior', signal(behavior, 1.0)],
          ['counter', signal(i, 1.0)],
          ['increment', signal(1, 1.0)]
        ]))
        results.push(result.get('output')?.value)
      }
      
      // Should be sequential
      expect(results).toEqual([1, 2, 3, 4, 5])
    })
    
    it('should produce consistent results regardless of Map iteration order', () => {
      const gadget = createDynamicGadget('map-order', {
        structure: {
          contacts: {
            'a': { direction: 'input' },
            'b': { direction: 'input' },
            'c': { direction: 'input' },
            'result': { direction: 'output' }
          }
        }
      })
      
      // Create maps with different insertion orders
      const map1 = new Map([
        ['a', signal(1, 1.0)],
        ['b', signal(2, 1.0)],
        ['c', signal(3, 1.0)]
      ])
      
      const map2 = new Map([
        ['c', signal(3, 1.0)],
        ['a', signal(1, 1.0)],
        ['b', signal(2, 1.0)]
      ])
      
      const map3 = new Map([
        ['b', signal(2, 1.0)],
        ['c', signal(3, 1.0)],
        ['a', signal(1, 1.0)]
      ])
      
      const result1 = gadget.compute!(map1)
      const result2 = gadget.compute!(map2)
      const result3 = gadget.compute!(map3)
      
      // All should handle inputs consistently
      expect(result1.size).toBe(result2.size)
      expect(result2.size).toBe(result3.size)
    })
  })
  
  describe('Behavior Binding Persistence', () => {
    it('should remember bound behavior across calls', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'x': { direction: 'input' },
            'y': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('persistent', spec)
      
      const behavior: BehaviorSpec = {
        compute: {
          type: 'propagate',
          from: 'x',
          to: 'y'
        }
      }
      
      // First call with behavior
      gadget.compute!(new Map([
        ['__behavior', signal(behavior, 1.0)],
        ['x', signal('first', 1.0)]
      ]))
      
      // Subsequent calls without behavior
      for (let i = 0; i < 5; i++) {
        const result = gadget.compute!(new Map([
          ['x', signal(`value_${i}`, 1.0)]
        ]))
        
        // Should still propagate
        expect(result.get('y')?.value).toBe(`value_${i}`)
      }
    })
    
    it('should maintain validator state', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'input': { direction: 'input' },
            'output': { direction: 'output' }
          }
        },
        bindings: {
          behavior: '__behavior',
          validator: '__validator'
        }
      }
      
      const gadget = createDynamicGadget('validated', spec)
      
      const validator = {
        type: 'sandbox',
        deny: ['dangerous']
      }
      
      // Bind validator once
      gadget.compute!(new Map([
        ['__validator', signal(validator, 1.0)]
      ]))
      
      const safeBehavior: BehaviorSpec = {
        compute: { type: 'propagate', from: 'input', to: 'output' }
      }
      
      const dangerousBehavior: BehaviorSpec = {
        compute: { type: 'primitive' as const, name: 'dangerous' }
      }
      
      // Try safe behavior - should work
      const safeResult = gadget.compute!(new Map([
        ['__behavior', signal(safeBehavior, 1.0)],
        ['input', signal('safe', 1.0)]
      ]))
      
      expect(safeResult.get('output')?.value).toBe('safe')
      
      // Try dangerous behavior - validator should still block
      const dangerResult = gadget.compute!(new Map([
        ['__behavior', signal(dangerousBehavior, 1.0)],
        ['input', signal('danger', 1.0)]
      ]))
      
      expect(dangerResult.get('__error')?.value).toBeDefined()
    })
  })
  
  describe('Template Interpretation Idempotence', () => {
    it('should create identical gadgets from same template', () => {
      const template: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: {
                'a': { direction: 'input', initial: { value: 10, strength: 0.5 } },
                'b': { direction: 'output' },
                'c': { direction: 'input' }
              },
              children: {
                'child1': {
                  structure: {
                    contacts: {
                      'x': { direction: 'input' }
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      const spawner1 = createSpawner('s1')
      provideSpawnerGain(spawner1, 100, 'test')
      const spawner2 = createSpawner('s2')
      provideSpawnerGain(spawner2, 100, 'test')
      
      const result1 = spawner1.compute!(new Map([
        ['template', signal(template, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      const result2 = spawner2.compute!(new Map([
        ['template', signal(template, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      const instance1 = result1.get('instance')?.value as InstanceSignal
      const instance2 = result2.get('instance')?.value as InstanceSignal
      
      const g1 = instance1?.value.gadget.deref()
      const g2 = instance2?.value.gadget.deref()
      
      // Should have identical structure
      expect(g1?.contacts.size).toBe(g2?.contacts.size)
      expect(g1?.gadgets.size).toBe(g2?.gadgets.size)
      
      // Check initial values
      const a1 = g1?.contacts.get('a')
      const a2 = g2?.contacts.get('a')
      expect(a1?.signal.value).toBe(a2?.signal.value)
      expect(a1?.signal.strength).toBe(a2?.signal.strength)
    })
    
    it('should handle template reuse consistently', () => {
      const template: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: {
                'shared': { direction: 'input' }
              }
            }
          }
        }
      }
      
      const spawner = createSpawner('reuse')
      provideSpawnerGain(spawner, 500, 'test')  // Enough for 5 spawns at 100 each
      
      // Spawn multiple from same template
      const instances = []
      for (let i = 0; i < 5; i++) {
        const result = spawner.compute!(new Map([
          ['template', signal(template, 1.0)],
          ['initialGain', signal(100, 1.0)],
          ['trigger', signal(true, 1.0)]
        ]))
        
        instances.push(result.get('instance')?.value)
      }
      
      // All should have same structure
      const gadgets = instances
        .map((i: any) => i?.value.gadget.deref())
        .filter(Boolean)
      
      for (const g of gadgets) {
        expect(g.contacts.size).toBe(1)
        expect(g.contacts.has('shared')).toBe(true)
        expect(g.gainPool).toBe(100)
      }
    })
  })
  
  describe('Receipt Consistency', () => {
    it('should generate consistent receipts for same operations', () => {
      const runSpawnSequence = () => {
        clearReceipts()
        
        const spawner = createSpawner('receipt-test')
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
        
        for (let i = 0; i < 3; i++) {
          spawner.compute!(new Map([
            ['template', signal(template, 1.0)],
            ['initialGain', signal(50, 1.0)],
            ['trigger', signal(true, 1.0)]
          ]))
        }
        
        return getAllReceipts()
      }
      
      const receipts1 = runSpawnSequence()
      const receipts2 = runSpawnSequence()
      const receipts3 = runSpawnSequence()
      
      // All should have same pattern
      expect(receipts1.length).toBe(receipts2.length)
      expect(receipts2.length).toBe(receipts3.length)
      
      for (let i = 0; i < receipts1.length; i++) {
        expect(receipts1[i].amount).toBe(receipts2[i].amount)
        expect(receipts2[i].amount).toBe(receipts3[i].amount)
      }
    })
    
    it('should maintain receipt order', () => {
      clearReceipts()
      
      const evolver = createEvolver('ordered')
      
      for (let i = 0; i < 5; i++) {
        const old = createGadget(`old_${i}`)
        const newG = createGadget(`new_${i}`)
        
        old.gainPool = 100
        newG.gainPool = 0
        
        const oldInstance: InstanceSignal = {
          tag: 'instance',
          value: {
            id: `old_${i}`,
            gadget: new WeakRef(old),
            born: Date.now(),
            generation: 1
          }
        }
        
        const newInstance: InstanceSignal = {
          tag: 'instance',
          value: {
            id: `new_${i}`,
            gadget: new WeakRef(newG),
            born: Date.now(),
            generation: 2
          }
        }
        
        evolver.compute!(new Map([
          ['old', signal(oldInstance, 1.0)],
          ['new', signal(newInstance, 1.0)],
          ['rate', signal(20, 1.0)]
        ]))
      }
      
      const receipts = getAllReceipts()
      
      // Should be in chronological order
      for (let i = 1; i < receipts.length; i++) {
        expect(receipts[i].timestamp).toBeGreaterThanOrEqual(receipts[i-1].timestamp)
      }
    })
  })
  
  describe('WeakRef Stability', () => {
    it('should handle WeakRef dereferencing consistently', () => {
      const gadgets = []
      const refs = []
      
      // Create gadgets and refs
      for (let i = 0; i < 10; i++) {
        const g = createGadget(`ref_${i}`)
        gadgets.push(g)
        refs.push(new WeakRef(g))
      }
      
      // All should be accessible initially
      for (const ref of refs) {
        expect(ref.deref()).toBeDefined()
      }
      
      // Clear some references
      for (let i = 0; i < 5; i++) {
        gadgets[i] = null as any
      }
      
      // Later refs should still work
      for (let i = 5; i < 10; i++) {
        expect(refs[i].deref()).toBeDefined()
      }
    })
    
    it('should handle parent-child WeakRef cycles', () => {
      const parent = createGadget('parent')
      const child = createGadget('child')
      
      child.parent = new WeakRef(parent)
      parent.gadgets.set('child', child)
      
      // Both directions should work
      expect(child.parent.deref()).toBe(parent)
      expect(parent.gadgets.get('child')).toBe(child)
      
      // Create grandchild
      const grandchild = createGadget('grandchild')
      grandchild.parent = new WeakRef(child)
      child.gadgets.set('grandchild', grandchild)
      
      // Chain should be navigable
      expect(grandchild.parent.deref()?.parent?.deref()).toBe(parent)
    })
  })
  
  describe('Signal Merge Consistency', () => {
    it('should merge signals deterministically', () => {
      const testMerge = () => {
        const g = createGadget('merge')
        const target = createContact('target', g, signal(0, 0.1), 'input')
        
        const sources = [
          createContact('s1', g, signal(0, 0.2), 'output'),
          createContact('s2', g, signal(0, 0.2), 'output'),
          createContact('s3', g, signal(0, 0.2), 'output')
        ]
        
        for (const source of sources) {
          wire(source, target)
        }
        
        // Propagate all with different strengths
        propagate(sources[0], signal('a', 0.3))
        propagate(sources[1], signal('b', 0.5))
        propagate(sources[2], signal('c', 0.4))
        
        return target.signal
      }
      
      // Run multiple times
      const results = []
      for (let i = 0; i < 10; i++) {
        results.push(testMerge())
      }
      
      // All should have same result (highest strength wins)
      for (const result of results) {
        expect(result.value).toBe('b') // Highest strength
        expect(result.strength).toBe(5000)
      }
    })
    
    it('should handle strength ties consistently', () => {
      const g = createGadget('tie')
      const target = createContact('target', g, signal(null, 0.1), 'input')
      
      const s1 = createContact('s1', g, signal(0, 0.3), 'output')
      const s2 = createContact('s2', g, signal(0, 0.3), 'output')
      
      wire(s1, target)
      wire(s2, target)
      
      // First signal sets value
      propagate(s1, signal('first', 0.5))
      expect(target.signal.value).toBe('first')
      
      // Same strength with different value creates contradiction
      propagate(s2, signal('second', 0.5))
      const contradictionValue = target.signal.value as any
      expect(contradictionValue.tag).toBe('contradiction')
      
      // Higher strength resolves contradiction
      propagate(s1, signal('resolved', 0.6))
      expect(target.signal.value).toBe('resolved')
    })
  })
  
  describe('Gadget State Consistency', () => {
    it('should maintain gainPool consistency', () => {
      const parent = createGadget('parent')
      parent.gainPool = 1000
      
      const children = []
      for (let i = 0; i < 5; i++) {
        const child = createGadget(`child_${i}`)
        child.gainPool = 100
        parent.gadgets.set(`child_${i}`, child)
        children.push(child)
      }
      
      // Total should be conserved
      const total = parent.gainPool + children.reduce((sum, c) => sum + c.gainPool, 0)
      expect(total).toBe(1500)
      
      // Transfer some gain
      const transfer = 50
      parent.gainPool -= transfer
      children[0].gainPool += transfer
      
      // Total should still be conserved
      const newTotal = parent.gainPool + children.reduce((sum, c) => sum + c.gainPool, 0)
      expect(newTotal).toBe(1500)
    })
    
    it('should maintain contact direction consistency', () => {
      const g = createGadget('directions')
      
      const contacts = [
        createContact('in1', g, signal(0, 0.5), 'input'),
        createContact('in2', g, signal(0, 0.5), 'input'),
        createContact('out1', g, signal(0, 0.5), 'output'),
        createContact('out2', g, signal(0, 0.5), 'output')
      ]
      
      for (const c of contacts) {
        g.contacts.set(c.id, c)
      }
      
      // Directions should not change
      expect(g.contacts.get('in1')?.direction).toBe('input')
      expect(g.contacts.get('in2')?.direction).toBe('input')
      expect(g.contacts.get('out1')?.direction).toBe('output')
      expect(g.contacts.get('out2')?.direction).toBe('output')
      
      // Even after propagation
      propagate(g.contacts.get('in1')!, signal('data', 0.8))
      
      expect(g.contacts.get('in1')?.direction).toBe('input')
    })
  })
  
  describe('Evolution State Consistency', () => {
    it('should maintain generation numbers', () => {
      const spawner = createSpawner('generational')
      
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
      
      const instances = []
      
      for (let i = 0; i < 5; i++) {
        const result = spawner.compute!(new Map([
          ['template', signal(template, 1.0)],
          ['trigger', signal(true, 1.0)]
        ]))
        
        const instance = result.get('instance')?.value as InstanceSignal
        instances.push(instance)
      }
      
      // Generations should increment
      for (let i = 0; i < instances.length - 1; i++) {
        expect(instances[i + 1].value.generation).toBeGreaterThan(
          instances[i].value.generation
        )
      }
    })
    
    it('should track evolution lineage', () => {
      const evolver = createEvolver('lineage')
      
      const ancestors = []
      let current = createGadget('gen0')
      current.gainPool = 1000
      
      for (let gen = 0; gen < 5; gen++) {
        const next = createGadget(`gen${gen + 1}`)
        next.gainPool = 0
        
        const currentInstance: InstanceSignal = {
          tag: 'instance',
          value: {
            id: `gen${gen}`,
            gadget: new WeakRef(current),
            born: Date.now(),
            generation: gen
          }
        }
        
        const nextInstance: InstanceSignal = {
          tag: 'instance',
          value: {
            id: `gen${gen + 1}`,
            gadget: new WeakRef(next),
            born: Date.now(),
            generation: gen + 1
          }
        }
        
        evolver.compute!(new Map([
          ['old', signal(currentInstance, 1.0)],
          ['new', signal(nextInstance, 1.0)],
          ['rate', signal(200, 1.0)]
        ]))
        
        ancestors.push(current)
        current = next
      }
      
      // Final generation should have most gain
      expect(current.gainPool).toBeGreaterThan(0)
      
      // Ancestors should be depleted
      for (const ancestor of ancestors) {
        expect(ancestor.gainPool).toBeLessThan(1000)
      }
    })
  })
  
  describe('Network Snapshot Consistency', () => {
    it('should produce consistent snapshots', () => {
      const createNetwork = () => {
        const net = createGadget('network')
        
        for (let i = 0; i < 3; i++) {
          const child = createGadget(`child_${i}`)
          child.gainPool = 100
          
          for (let j = 0; j < 2; j++) {
            const contact = createContact(`c${j}`, child, signal(i * 10 + j, 0.5), 'input')
            child.contacts.set(`c${j}`, contact)
          }
          
          net.gadgets.set(`child_${i}`, child)
        }
        
        return net
      }
      
      const net1 = createNetwork()
      const net2 = createNetwork()
      
      // Should have identical structure
      expect(net1.gadgets.size).toBe(net2.gadgets.size)
      
      for (const [id, child1] of net1.gadgets) {
        const child2 = net2.gadgets.get(id)
        expect(child2).toBeDefined()
        expect(child1.gainPool).toBe(child2?.gainPool)
        expect(child1.contacts.size).toBe(child2?.contacts.size)
      }
    })
  })
})