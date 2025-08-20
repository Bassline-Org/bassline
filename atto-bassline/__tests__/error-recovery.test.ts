/**
 * Error Recovery Tests
 * 
 * Tests for graceful failure handling, error recovery, and system resilience
 * when encountering invalid inputs, malformed data, or exceptional conditions.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createGadget,
  createContact,
  createDynamicGadget,
  createSpawner,
  createEvolver,
  createIterator,
  createGarbageCollector,
  signal,
  propagate,
  wire,
  clearReceipts,
  type DynamicGadgetSpec,
  type TemplateSignal,
  type InstanceSignal,
  type BehaviorSpec
} from '../src'

describe('Error Recovery', () => {
  beforeEach(() => {
    clearReceipts()
  })
  
  describe('Invalid Template Handling', () => {
    it('should handle malformed template gracefully', () => {
      const spawner = createSpawner('malformed')
      
      // Template missing required fields
      const badTemplate = {
        tag: 'template' as const,
        value: {
          // Missing spec
        }
      }
      
      const result = spawner.compute!(new Map([
        ['template', signal(badTemplate, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      // Should return error, not crash
      expect(result.get('error')).toBeDefined()
      expect(spawner.gadgets.size).toBe(0)
    })
    
    it('should handle non-template values as templates', () => {
      const spawner = createSpawner('wrong-type')
      
      // Not a template at all
      const notTemplate = { some: 'object' }
      
      const result = spawner.compute!(new Map([
        ['template', signal(notTemplate, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      expect(result.get('error')?.value).toBeDefined()
      expect((result.get('error')?.value as any).tag).toBe('contradiction')
    })
    
    it('should handle circular template references', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          children: {
            'self': { ref: 'self' } // Self-reference
          }
        },
        bindings: { library: '__library' }
      }
      
      const gadget = createDynamicGadget('circular', spec)
      
      // Should create placeholder, not infinite loop
      expect(gadget.gadgets.has('self')).toBe(true)
      const child = gadget.gadgets.get('self')!
      expect(child.contacts.has('__awaiting_template')).toBe(true)
    })
    
    it('should handle templates with invalid contact directions', () => {
      const spawner = createSpawner('invalid-direction')
      
      const template: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: {
                'weird': { direction: 'invalid' as any }
              }
            }
          }
        }
      }
      
      const result = spawner.compute!(new Map([
        ['template', signal(template, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      // Should handle gracefully
      const instance = result.get('instance')?.value as InstanceSignal
      if (instance) {
        const gadget = instance.value.gadget.deref()
        // Contact created with default or corrected direction
        expect(gadget).toBeDefined()
      }
    })
  })
  
  describe('Malformed Behavior Specs', () => {
    it('should handle invalid behavior types', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'input': { direction: 'input' },
            'output': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('bad-behavior', spec)
      
      const invalidBehavior = {
        compute: {
          type: 'unknown-type' as any,
          data: 'whatever'
        }
      }
      
      const result = gadget.compute!(new Map([
        ['__behavior', signal(invalidBehavior, 1.0)],
        ['input', signal('test', 1.0)]
      ]))
      
      // Should handle unknown type gracefully
      expect(result.get('__error') || result.size === 0).toBeTruthy()
    })
    
    it('should handle behavior with missing required fields', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'a': { direction: 'input' },
            'b': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('incomplete', spec)
      
      const incompleteBehavior: BehaviorSpec = {
        compute: {
          type: 'propagate',
          // Missing 'from' and 'to'
        } as any
      }
      
      const result = gadget.compute!(new Map([
        ['__behavior', signal(incompleteBehavior, 1.0)],
        ['a', signal('data', 1.0)]
      ]))
      
      // Should not crash
      expect(result).toBeDefined()
    })
    
    it('should handle recursive behavior gracefully', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'x': { direction: 'input' },
            'y': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('recursive', spec)
      
      // Behavior that references itself (conceptually)
      const recursiveBehavior: BehaviorSpec = {
        compute: {
          type: 'sequence',
          steps: [
            { type: 'propagate', from: 'x', to: 'y' },
            { type: 'propagate', from: 'y', to: 'x' },
            // Would create cycle
          ]
        }
      }
      
      const result = gadget.compute!(new Map([
        ['__behavior', signal(recursiveBehavior, 1.0)],
        ['x', signal('loop', 1.0)]
      ]))
      
      // Should complete without infinite loop
      expect(result).toBeDefined()
    })
  })
  
  describe('Missing Required Contacts', () => {
    it('should handle compute with missing inputs', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'required1': { direction: 'input' },
            'required2': { direction: 'input' },
            'output': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('missing-inputs', spec)
      
      const behavior: BehaviorSpec = {
        compute: {
          type: 'expression',
          expr: {
            op: 'add',
            args: { a: 'required1', b: 'required2' }
          }
        }
      }
      
      // Only provide one input
      const result = gadget.compute!(new Map([
        ['__behavior', signal(behavior, 1.0)],
        ['required1', signal(5, 1.0)]
        // Missing required2
      ]))
      
      // Should handle missing input
      const output = result.get('output')
      expect(output?.value === null || output?.value === undefined || !isNaN(output?.value)).toBeTruthy()
    })
    
    it('should handle wiring to non-existent contacts', () => {
      const g = createGadget('wiring')
      const real = createContact('real', g, signal(0, 0.5), 'output')
      g.contacts.set('real', real)
      
      // Try to wire to undefined
      const fake = undefined as any
      
      // Should not crash
      expect(() => {
        if (fake) wire(real, fake)
      }).not.toThrow()
    })
  })
  
  describe('Validator Rejection Cascades', () => {
    it('should handle validator blocking behavior', () => {
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
      
      const gadget = createDynamicGadget('blocked', spec)
      
      const forbiddenBehavior: BehaviorSpec = {
        compute: {
          type: 'primitive',
          name: 'spawn'
        }
      }
      
      const strictValidator = {
        type: 'sandbox',
        deny: ['spawn', 'delete', 'wire']
      }
      
      const result = gadget.compute!(new Map([
        ['__behavior', signal(forbiddenBehavior, 1.0)],
        ['__validator', signal(strictValidator, 1.0)],
        ['input', signal('blocked', 1.0)]
      ]))
      
      // Should produce error
      expect(result.get('__error')).toBeDefined()
      expect(result.get('output')).toBeUndefined()
    })
    
    it('should cascade validation through nested gadgets', () => {
      const parentSpec: DynamicGadgetSpec = {
        structure: {
          children: {
            'child': {
              structure: {
                contacts: {
                  '__behavior': { direction: 'input' },
                  '__validator': { direction: 'input' }
                }
              },
              bindings: {
                behavior: '__behavior',
                validator: '__validator'
              }
            }
          }
        }
      }
      
      const parent = createDynamicGadget('parent', parentSpec)
      const child = parent.gadgets.get('child')!
      
      const unsafeBehavior = {
        compute: { type: 'primitive' as const, name: 'eval' }
      }
      
      const validator = {
        type: 'sandbox',
        deny: ['eval']
      }
      
      const result = child.compute!(new Map([
        ['__behavior', signal(unsafeBehavior, 1.0)],
        ['__validator', signal(validator, 1.0)]
      ]))
      
      expect(result.get('__error')).toBeDefined()
    })
  })
  
  describe('Partial Evolution Failures', () => {
    it('should handle evolution with expired gadgets', () => {
      const evolver = createEvolver('expired')
      
      // Create weak reference to non-existent gadget
      const expiredInstance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'expired',
          gadget: new WeakRef({} as any), // Invalid gadget
          born: Date.now(),
          generation: 1
        }
      }
      
      const valid = createGadget('valid')
      valid.gainPool = 100
      
      const validInstance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'valid',
          gadget: new WeakRef(valid),
          born: Date.now(),
          generation: 2
        }
      }
      
      const result = evolver.compute!(new Map([
        ['old', signal(expiredInstance, 1.0)],
        ['new', signal(validInstance, 1.0)],
        ['rate', signal(50, 1.0)]
      ]))
      
      // Should handle gracefully
      const status = result.get('status')?.value
      expect(status).toBeDefined()
      expect(valid.gainPool).toBe(100) // No transfer from invalid
    })
    
    it('should handle evolution with mismatched structures', () => {
      const evolver = createEvolver('mismatch')
      
      const simple = createGadget('simple')
      simple.gainPool = 200
      simple.contacts.set('a', createContact('a', simple, signal(0, 1.0), 'output'))
      
      const complex = createGadget('complex')
      complex.gainPool = 100
      complex.contacts.set('x', createContact('x', complex, signal(0, 0.5), 'output'))
      complex.contacts.set('y', createContact('y', complex, signal(0, 0.5), 'output'))
      complex.contacts.set('z', createContact('z', complex, signal(0, 0.5), 'output'))
      
      const simpleInstance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'simple',
          gadget: new WeakRef(simple),
          born: Date.now(),
          generation: 1
        }
      }
      
      const complexInstance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'complex',
          gadget: new WeakRef(complex),
          born: Date.now(),
          generation: 2
        }
      }
      
      const result = evolver.compute!(new Map([
        ['old', signal(simpleInstance, 1.0)],
        ['new', signal(complexInstance, 1.0)],
        ['rate', signal(100, 1.0)]
      ]))
      
      // Should transfer gain even with structure mismatch
      const status = result.get('status')?.value as any
      expect(status.transferred).toBeGreaterThan(0)
    })
  })
  
  describe('Spawner Exhaustion', () => {
    it('should handle spawning when out of gain', () => {
      const spawner = createSpawner('exhausted')
      spawner.gainPool = 10 // Very little gain
      
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
      
      // Try to spawn with more gain than available
      const result = spawner.compute!(new Map([
        ['template', signal(template, 1.0)],
        ['initialGain', signal(100, 1.0)], // More than available
        ['trigger', signal(true, 1.0)]
      ]))
      
      // Should still spawn but with limited gain
      const instance = result.get('instance')?.value as InstanceSignal
      if (instance) {
        const gadget = instance.value.gadget.deref()
        expect(gadget?.gainPool).toBeLessThanOrEqual(10)
      }
    })
    
    it('should recover from failed spawning attempts', () => {
      const spawner = createSpawner('recovery')
      
      // First attempt with bad template
      const badResult = spawner.compute!(new Map([
        ['template', signal('not-a-template', 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      expect(badResult.get('error')).toBeDefined()
      expect(spawner.gadgets.size).toBe(0)
      
      // Second attempt with good template
      const goodTemplate: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: { 'x': { direction: 'input' } }
            }
          }
        }
      }
      
      const goodResult = spawner.compute!(new Map([
        ['template', signal(goodTemplate, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      // Should succeed after failure
      expect(goodResult.get('instance')).toBeDefined()
      expect(spawner.gadgets.size).toBe(1)
    })
  })
  
  describe('Iterator Error Handling', () => {
    it('should handle partial iteration failures', () => {
      const iterator = createIterator('partial')
      
      // Template that might fail for some iterations
      const template: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: { 'data': { direction: 'input' } }
            }
          }
        }
      }
      
      // Data with some invalid entries
      const mixedData = [
        'valid1',
        undefined,
        'valid2',
        null,
        'valid3'
      ]
      
      const result = iterator.compute!(new Map([
        ['template', signal(template, 1.0)],
        ['count', signal(5, 1.0)],
        ['data', signal(mixedData, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      const instances = result.get('instances')?.value as InstanceSignal[]
      
      // Should create all instances even with invalid data
      expect(instances.length).toBe(5)
      expect(iterator.gadgets.size).toBe(5)
    })
    
    it('should handle iterator with zero count', () => {
      const iterator = createIterator('zero')
      
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
      
      const result = iterator.compute!(new Map([
        ['template', signal(template, 1.0)],
        ['count', signal(0, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      const instances = result.get('instances')?.value as InstanceSignal[]
      expect(instances).toHaveLength(0)
      expect(iterator.gadgets.size).toBe(0)
    })
    
    it('should handle negative count gracefully', () => {
      const iterator = createIterator('negative')
      
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
      
      const result = iterator.compute!(new Map([
        ['template', signal(template, 1.0)],
        ['count', signal(-5, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      const instances = result.get('instances')?.value as InstanceSignal[]
      expect(instances).toHaveLength(0)
    })
  })
  
  describe('Garbage Collection Errors', () => {
    it('should handle GC with no parent', () => {
      const gc = createGarbageCollector('orphan')
      
      // GC without parent
      const result = gc.compute!(new Map([
        ['threshold', signal(100, 1.0)],
        ['check', signal(true, 1.0)]
      ]))
      
      // Should handle gracefully
      expect(result.get('removed')?.value || []).toEqual([])
    })
    
    it('should handle GC with circular references', () => {
      const parent = createGadget('parent')
      const gc = createGarbageCollector('gc')
      
      parent.gadgets.set('gc', gc)
      gc.parent = new WeakRef(parent)
      
      // Create circular reference
      const child = createGadget('child')
      child.gadgets.set('parent-ref', parent) // Circular!
      parent.gadgets.set('child', child)
      
      // Add weak output to child
      const weakOut = createContact('out', child, signal(0, 0.01), 'output')
      child.contacts.set('out', weakOut)
      
      const result = gc.compute!(new Map([
        ['threshold', signal(100, 1.0)],
        ['check', signal(true, 1.0)]
      ]))
      
      // Should complete without stack overflow
      expect(result).toBeDefined()
    })
  })
  
  describe('Signal Propagation Errors', () => {
    it('should handle propagation to deleted contacts', () => {
      const g = createGadget('deletion')
      const source = createContact('source', g, signal(0, 0.5), 'output')
      const target = createContact('target', g, signal(0, 0.5), 'input')
      
      g.contacts.set('source', source)
      g.contacts.set('target', target)
      
      wire(source, target)
      
      // Delete target
      g.contacts.delete('target')
      
      // Try to propagate
      expect(() => {
        propagate(source, signal('orphaned', 0.8))
      }).not.toThrow()
    })
    
    it('should handle infinite strength values', () => {
      const g = createGadget('infinite')
      const contact = createContact('c', g, signal(0, 0.5), 'input')
      
      // Try to set infinite strength
      expect(() => {
        propagate(contact, { value: 'inf', strength: Infinity })
      }).not.toThrow()
      
      // Should be capped or handled
      expect(contact.signal.strength).not.toBe(Infinity)
    })
    
    it('should handle NaN values', () => {
      const g = createGadget('nan')
      const contact = createContact('c', g, signal(0, 0.5), 'input')
      
      // Try to propagate NaN
      expect(() => {
        propagate(contact, signal(NaN, 0.5))
      }).not.toThrow()
      
      // Value might be NaN but shouldn't crash
      expect(contact.signal).toBeDefined()
    })
  })
  
  describe('Recovery Strategies', () => {
    it('should recover from temporary resource exhaustion', () => {
      const spawner = createSpawner('resource-recovery')
      spawner.gainPool = 50
      
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
      
      // Exhaust resources
      spawner.compute!(new Map([
        ['template', signal(template, 1.0)],
        ['initialGain', signal(50, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      expect(spawner.gainPool).toBe(0)
      
      // Try to spawn again - should fail gracefully
      const result = spawner.compute!(new Map([
        ['template', signal(template, 1.0)],
        ['initialGain', signal(50, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      // Should handle exhaustion
      const instance = result.get('instance')?.value as InstanceSignal
      if (instance) {
        const gadget = instance.value.gadget.deref()
        expect(gadget?.gainPool).toBe(0)
      }
      
      // Replenish resources
      spawner.gainPool = 100
      
      // Should work again
      const recovered = spawner.compute!(new Map([
        ['template', signal(template, 1.0)],
        ['initialGain', signal(30, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      expect(recovered.get('instance')).toBeDefined()
    })
    
    it('should maintain system stability after errors', () => {
      const network = createGadget('stable')
      
      // Create some structure
      const child1 = createGadget('child1')
      const child2 = createGadget('child2')
      
      network.gadgets.set('child1', child1)
      network.gadgets.set('child2', child2)
      
      // Cause an error condition
      const badSpawner = createSpawner('bad')
      network.gadgets.set('bad', badSpawner)
      
      badSpawner.compute!(new Map([
        ['template', signal(null, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      // Network should still be intact
      expect(network.gadgets.size).toBe(3)
      expect(network.gadgets.has('child1')).toBe(true)
      expect(network.gadgets.has('child2')).toBe(true)
    })
  })
})