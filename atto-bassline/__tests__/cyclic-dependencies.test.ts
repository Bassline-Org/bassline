/**
 * Cyclic Dependency Tests
 * 
 * Tests for handling circular references, feedback loops, and recursive structures
 * without infinite loops or stack overflows.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createGadget,
  createContact,
  createDynamicGadget,
  createSpawner,
  createEvolver,
  createIterator,
  signal,
  propagate,
  wire,
  clearReceipts,
  type DynamicGadgetSpec,
  type TemplateSignal,
  type InstanceSignal
} from '../src'

describe('Cyclic Dependencies', () => {
  beforeEach(() => {
    clearReceipts()
  })
  
  describe('Simple Wire Cycles', () => {
    it('should handle direct self-loop without infinite propagation', () => {
      const g = createGadget('self-loop')
      const contact = createContact('loop', g, signal(0, 0.5), 'input')
      g.contacts.set('loop', contact)
      
      // Create self-loop
      wire(contact, contact)
      
      // Propagate should not cause infinite loop
      propagate(contact, signal(42, 0.8))
      
      // Value should update once
      expect(contact.signal.value).toBe(42)
      expect(contact.signal.strength).toBe(8000)
      
      // Propagate again - should update
      propagate(contact, signal(100, 0.9))
      expect(contact.signal.value).toBe(100)
    })
    
    it('should handle two-node cycles', () => {
      const g = createGadget('two-cycle')
      const a = createContact('a', g, signal(0, 0.5), 'input')
      const b = createContact('b', g, signal(0, 0.5), 'input')
      
      g.contacts.set('a', a)
      g.contacts.set('b', b)
      
      // Create cycle: a -> b -> a
      wire(a, b)
      wire(b, a)
      
      // Propagate to one node
      propagate(a, signal('data', 0.7))
      
      // Both should have the value (stronger signal wins)
      expect(a.signal.value).toBe('data')
      expect(b.signal.value).toBe('data')
      
      // Propagate stronger signal to b
      propagate(b, signal('override', 0.9))
      
      // Stronger signal should dominate
      expect(a.signal.value).toBe('override')
      expect(b.signal.value).toBe('override')
    })
    
    it('should handle multi-node cycles', () => {
      const g = createGadget('multi-cycle')
      const contacts = new Map<string, any>()
      
      // Create ring of 5 contacts
      for (let i = 0; i < 5; i++) {
        const c = createContact(`c${i}`, g, signal(0, 0.1), 'input')
        contacts.set(`c${i}`, c)
        g.contacts.set(`c${i}`, c)
      }
      
      // Wire in a ring
      for (let i = 0; i < 5; i++) {
        const next = (i + 1) % 5
        wire(contacts.get(`c${i}`), contacts.get(`c${next}`))
      }
      
      // Inject signal at one point
      propagate(contacts.get('c0'), signal('ring', 0.8))
      
      // Should propagate around ring without infinite loop
      for (let i = 0; i < 5; i++) {
        expect(contacts.get(`c${i}`).signal.value).toBe('ring')
      }
    })
  })
  
  describe('Nested Gadget Cycles', () => {
    it('should handle parent-child reference cycles', () => {
      const parent = createGadget('parent')
      const child = createGadget('child')
      const grandchild = createGadget('grandchild')
      
      // Create cycle in hierarchy
      parent.gadgets.set('child', child)
      child.parent = new WeakRef(parent)
      
      child.gadgets.set('grandchild', grandchild)
      grandchild.parent = new WeakRef(child)
      
      // Add back-reference (conceptual cycle)
      grandchild.gadgets.set('ref-to-parent', parent)
      
      // Should not cause issues
      expect(parent.gadgets.has('child')).toBe(true)
      expect(child.gadgets.has('grandchild')).toBe(true)
      expect(grandchild.gadgets.has('ref-to-parent')).toBe(true)
      
      // Check parent refs still work
      expect(child.parent?.deref()).toBe(parent)
      expect(grandchild.parent?.deref()).toBe(child)
    })
    
    it('should handle cross-wiring between nested levels', () => {
      const root = createGadget('root')
      const child1 = createGadget('child1')
      const child2 = createGadget('child2')
      
      root.gadgets.set('c1', child1)
      root.gadgets.set('c2', child2)
      
      const c1out = createContact('out', child1, signal(0, 0.5), 'output')
      const c2in = createContact('in', child2, signal(0, 0.5), 'input')
      const c2out = createContact('out', child2, signal(0, 0.5), 'output')
      const c1in = createContact('in', child1, signal(0, 0.5), 'input')
      
      child1.contacts.set('out', c1out)
      child1.contacts.set('in', c1in)
      child2.contacts.set('in', c2in)
      child2.contacts.set('out', c2out)
      
      // Cross-wire creating cycle
      wire(c1out, c2in)
      wire(c2out, c1in)
      
      // Should handle propagation
      propagate(c1out, signal('cross', 0.7))
      
      // c1out -> c2in should work
      expect(c2in.signal.value).toBe('cross')
      
      // c2out -> c1in would only work if c2 computed and forwarded
      // Since child2 has no compute function, c2out keeps its initial value
      // This is correct behavior - no automatic forwarding without compute
      expect(c1in.signal.value).toBe(0)  // Still initial value
    })
  })
  
  describe('Template Self-Reference', () => {
    it('should handle templates that reference themselves', () => {
      const recursiveSpec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'input': { direction: 'input' },
            'output': { direction: 'output' }
          },
          children: {
            // Reference to own template (would need library)
            'nested': { ref: 'self' }
          }
        },
        bindings: {
          library: '__library'
        }
      }
      
      const gadget = createDynamicGadget('recursive', recursiveSpec)
      
      // Should create placeholder for unresolved reference
      expect(gadget.gadgets.has('nested')).toBe(true)
      const nested = gadget.gadgets.get('nested')!
      expect(nested.contacts.has('__awaiting_template')).toBe(true)
    })
    
    it('should prevent infinite template expansion', () => {
      const spawner = createSpawner('recursive-spawner')
      
      // Template that would spawn itself
      const selfTemplate: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: {
                'template': { direction: 'input' },
                'trigger': { direction: 'input' },
                'instance': { direction: 'output' }
              },
              children: {
                'inner-spawner': {
                  structure: {
                    contacts: {
                      'template': { direction: 'input' },
                      'trigger': { direction: 'input' }
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      // Spawn should work once
      const result = spawner.compute!(new Map([
        ['template', signal(selfTemplate, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      expect(result.get('instance')).toBeDefined()
      expect(spawner.gadgets.size).toBe(1)
      
      // Spawned gadget has spawner structure but not behavior
      const spawned = [...spawner.gadgets.values()][0]
      expect(spawned.gadgets.has('inner-spawner')).toBe(true)
    })
  })
  
  describe('Spawner Creating Spawners', () => {
    it('should handle spawner chains without stack overflow', () => {
      const metaSpawner = createSpawner('meta')
      
      const spawnerTemplate: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: {
                'template': { direction: 'input' },
                'trigger': { direction: 'input' },
                'instance': { direction: 'output' }
              }
            }
          }
        }
      }
      
      // Create chain of spawners
      const instances = []
      let currentSpawner = metaSpawner
      
      for (let i = 0; i < 5; i++) {
        const result = currentSpawner.compute!(new Map([
          ['template', signal(spawnerTemplate, 1.0)],
          ['initialGain', signal(100 - i * 10, 1.0)],
          ['trigger', signal(true, 1.0)]
        ]))
        
        const instance = result.get('instance')?.value as InstanceSignal
        if (instance) {
          instances.push(instance)
          const nextSpawner = instance.value.gadget.deref()
          if (nextSpawner) {
            // Can't actually spawn from it without behavior, but structure is there
            expect(nextSpawner.contacts.has('template')).toBe(true)
          }
        }
      }
      
      expect(instances.length).toBeGreaterThan(0)
    })
    
    it('should handle mutual spawning patterns', () => {
      const spawnerA = createSpawner('A')
      const spawnerB = createSpawner('B')
      
      // Template for simple gadget
      const simpleTemplate: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: {
                'data': { direction: 'input' }
              }
            }
          }
        }
      }
      
      // A spawns something
      const resultA = spawnerA.compute!(new Map([
        ['template', signal(simpleTemplate, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      // B spawns something
      const resultB = spawnerB.compute!(new Map([
        ['template', signal(simpleTemplate, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      // Both should succeed independently
      expect(resultA.get('instance')).toBeDefined()
      expect(resultB.get('instance')).toBeDefined()
    })
  })
  
  describe('Evolution Cycles', () => {
    it('should handle evolution chains that form cycles', () => {
      const evolver = createEvolver('cyclic-evolver')
      
      // Create circular evolution: A -> B -> C -> A
      const gadgetA = createGadget('A')
      const gadgetB = createGadget('B')
      const gadgetC = createGadget('C')
      
      gadgetA.gainPool = 300
      gadgetB.gainPool = 200
      gadgetC.gainPool = 100
      
      const instanceA: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'A',
          gadget: new WeakRef(gadgetA),
          born: Date.now(),
          generation: 1
        }
      }
      
      const instanceB: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'B',
          gadget: new WeakRef(gadgetB),
          born: Date.now(),
          generation: 2
        }
      }
      
      const instanceC: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'C',
          gadget: new WeakRef(gadgetC),
          born: Date.now(),
          generation: 3
        }
      }
      
      // Evolve A -> B
      evolver.compute!(new Map([
        ['old', signal(instanceA, 1.0)],
        ['new', signal(instanceB, 1.0)],
        ['rate', signal(50, 1.0)]
      ]))
      
      // Evolve B -> C
      evolver.compute!(new Map([
        ['old', signal(instanceB, 1.0)],
        ['new', signal(instanceC, 1.0)],
        ['rate', signal(50, 1.0)]
      ]))
      
      // Evolve C -> A (closing the cycle)
      evolver.compute!(new Map([
        ['old', signal(instanceC, 1.0)],
        ['new', signal(instanceA, 1.0)],
        ['rate', signal(50, 1.0)]
      ]))
      
      // Should have redistributed gain
      const totalGain = gadgetA.gainPool + gadgetB.gainPool + gadgetC.gainPool
      expect(totalGain).toBe(600) // Conservation of gain
    })
    
    it('should handle self-evolution gracefully', () => {
      const evolver = createEvolver('self-evolver')
      const gadget = createGadget('self')
      gadget.gainPool = 1000
      
      const instance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'self',
          gadget: new WeakRef(gadget),
          born: Date.now(),
          generation: 1
        }
      }
      
      // Try to evolve to itself
      const result = evolver.compute!(new Map([
        ['old', signal(instance, 1.0)],
        ['new', signal(instance, 1.0)],
        ['rate', signal(100, 1.0)]
      ]))
      
      // Should handle gracefully - no actual transfer
      expect(gadget.gainPool).toBe(1000)
      
      const status = result.get('status')?.value as any
      expect(status.transferred).toBe(0)
    })
  })
  
  describe('Garbage Collection Cycles', () => {
    it('should not garbage collect in cycles', () => {
      const parent = createGadget('parent')
      
      // Create mutually dependent gadgets
      const gadgetA = createGadget('A')
      const gadgetB = createGadget('B')
      
      const aOut = createContact('out', gadgetA, signal('a', 0.009), 'output')
      const bOut = createContact('out', gadgetB, signal('b', 0.009), 'output')
      const aIn = createContact('in', gadgetA, signal(null, 0.009), 'input')
      const bIn = createContact('in', gadgetB, signal(null, 0.009), 'input')
      
      gadgetA.contacts.set('out', aOut)
      gadgetA.contacts.set('in', aIn)
      gadgetB.contacts.set('out', bOut)
      gadgetB.contacts.set('in', bIn)
      
      // Create cycle
      wire(aOut, bIn)
      wire(bOut, aIn)
      
      parent.gadgets.set('A', gadgetA)
      parent.gadgets.set('B', gadgetB)
      
      // Both have weak outputs but are connected
      expect(aOut.signal.strength).toBeLessThan(100)
      expect(bOut.signal.strength).toBeLessThan(100)
      
      // They form a cycle so both exist
      expect(parent.gadgets.has('A')).toBe(true)
      expect(parent.gadgets.has('B')).toBe(true)
    })
    
    it('should handle WeakRef cycles in instance references', () => {
      const iterator = createIterator('cyclic-iterator')
      
      const cyclicTemplate: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: {
                'prev': { direction: 'input' },
                'next': { direction: 'output' }
              }
            }
          }
        }
      }
      
      // Create ring of instances
      const result = iterator.compute!(new Map([
        ['template', signal(cyclicTemplate, 1.0)],
        ['count', signal(3, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      const instances = result.get('instances')?.value as InstanceSignal[]
      expect(instances).toHaveLength(3)
      
      // Wire them in a ring manually (iterator chains linearly)
      const gadgets = instances.map(i => i.value.gadget.deref()!).filter(Boolean)
      if (gadgets.length === 3) {
        const last = gadgets[2].contacts.get('next')
        const first = gadgets[0].contacts.get('prev')
        
        if (last && first) {
          wire(last, first) // Complete the cycle
        }
        
        // All should still be accessible
        for (const g of gadgets) {
          expect(g.contacts.size).toBeGreaterThan(0)
        }
      }
    })
  })
  
  describe('Behavior Recursion', () => {
    it('should handle recursive behavior specifications', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'n': { direction: 'input' },
            'result': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('factorial', spec)
      
      // Recursive behavior (conceptual - would need conditional termination)
      const recursiveBehavior = {
        compute: {
          type: 'conditional' as const,
          condition: { op: 'get', args: { name: 'n' } },
          then: {
            type: 'expression' as const,
            expr: { op: 'constant', args: { value: 'recurse' } }
          },
          else: {
            type: 'expression' as const,
            expr: { op: 'constant', args: { value: 1 } }  // 0 is falsy, so this is base case
          }
        }
      }
      
      const result = gadget.compute!(new Map([
        ['__behavior', signal(recursiveBehavior, 1.0)],
        ['n', signal(0, 1.0)]
      ]))
      
      // Base case should work
      expect(result.get('output')?.value).toBe(1)
    })
    
    it('should prevent infinite compute loops', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'input': { direction: 'input' },
            'output': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('infinite', spec)
      
      // Behavior that would loop forever
      const loopBehavior = {
        compute: {
          type: 'sequence' as const,
          steps: [
            { type: 'propagate' as const, from: 'input', to: 'output' },
            { type: 'propagate' as const, from: 'output', to: 'input' }
          ]
        }
      }
      
      // Should complete without hanging
      const result = gadget.compute!(new Map([
        ['__behavior', signal(loopBehavior, 1.0)],
        ['input', signal('data', 1.0)]
      ]))
      
      // Should complete (not hang), result might be empty
      expect(result).toBeDefined()
      // The important thing is it didn't infinite loop
    })
  })
  
  describe('Circular Library Dependencies', () => {
    it('should handle templates with circular library references', () => {
      const libA: Record<string, TemplateSignal> = {}
      const libB: Record<string, TemplateSignal> = {}
      
      // A references B
      libA['templateA'] = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              children: {
                'uses-b': { ref: 'templateB' }
              }
            }
          }
        }
      }
      
      // B references A (circular)
      libB['templateB'] = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              children: {
                'uses-a': { ref: 'templateA' }
              }
            }
          }
        }
      }
      
      // Should handle without infinite expansion
      const spec: DynamicGadgetSpec = {
        structure: {
          children: {
            'from-a': { ref: 'templateA' }
          }
        },
        bindings: { library: '__library' }
      }
      
      const gadget = createDynamicGadget('circular-lib', spec)
      
      // Has placeholder for unresolved reference
      expect(gadget.gadgets.has('from-a')).toBe(true)
    })
  })
  
  describe('Cycle Detection', () => {
    it('should detect and handle propagation cycles', () => {
      const g = createGadget('detector')
      const contacts = new Map<string, any>()
      
      // Create diamond pattern that converges
      //     a
      //    / \
      //   b   c
      //    \ /
      //     d
      const a = createContact('a', g, signal(0, 0.5), 'output')
      const b = createContact('b', g, signal(0, 0.3), 'input')
      const c = createContact('c', g, signal(0, 0.3), 'input')
      const d = createContact('d', g, signal(0, 0.3), 'input')
      
      g.contacts.set('a', a)
      g.contacts.set('b', b)
      g.contacts.set('c', c)
      g.contacts.set('d', d)
      
      wire(a, b)
      wire(a, c)
      wire(b, d)
      wire(c, d)
      
      // Add back-edge to create cycle
      wire(d, a)
      
      // Propagate - should handle cycle
      propagate(a, signal('diamond', 0.9))
      
      // All should have the value
      expect(b.signal.value).toBe('diamond')
      expect(c.signal.value).toBe('diamond')
      expect(d.signal.value).toBe('diamond')
      
      // Cycle should stabilize
      expect(a.signal.value).toBe('diamond')
    })
  })
})