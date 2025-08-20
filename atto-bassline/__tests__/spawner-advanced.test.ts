/**
 * Advanced tests for spawner gadgets and dynamic behavior
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createDynamicGadget,
  createSpawner,
  createEvolver,
  createIterator,
  createGarbageCollector,
  createConditionalSpawner,
  provideSpawnerGain,
  signal,
  propagate,
  createGadget,
  createContact,
  wire,
  clearReceipts,
  getAllReceipts,
  type DynamicGadgetSpec,
  type TemplateSignal,
  type InstanceSignal,
  type BehaviorSpec
} from '../src'

describe('Advanced Spawner Tests', () => {
  beforeEach(() => {
    clearReceipts()
  })
  
  describe('Nested Spawning', () => {
    it('should allow spawners to spawn other spawners', () => {
      const metaSpawner = createSpawner('meta')
      
      // Template for a spawner
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
      
      // Spawn a spawner
      const outputs = metaSpawner.compute!(new Map([
        ['template', signal(spawnerTemplate, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      const instance = outputs.get('instance')?.value as InstanceSignal
      expect(instance).toBeDefined()
      
      // The spawned gadget should have spawner-like contacts
      const spawnedSpawner = instance.value.gadget.deref()
      expect(spawnedSpawner?.contacts.has('template')).toBe(true)
      expect(spawnedSpawner?.contacts.has('trigger')).toBe(true)
    })
    
    it('should handle recursive template references', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          children: {
            'child': { ref: 'childTemplate' }  // Reference to be resolved
          }
        },
        bindings: {
          library: '__library'
        }
      }
      
      const parent = createDynamicGadget('parent', spec)
      
      // Child should be placeholder initially
      expect(parent.gadgets.has('child')).toBe(true)
      const child = parent.gadgets.get('child')!
      expect(child.contacts.has('__awaiting_template')).toBe(true)
    })
  })
  
  describe('Behavior Validation', () => {
    it('should reject behavior without validator approval', () => {
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
      
      const dangerousBehavior: BehaviorSpec = {
        compute: {
          type: 'primitive',
          name: 'dangerous_operation'
        }
      }
      
      const validator = {
        type: 'sandbox',
        deny: ['dangerous_operation']
      }
      
      const outputs = gadget.compute!(new Map([
        ['__behavior', signal(dangerousBehavior, 1.0)],
        ['__validator', signal(validator, 1.0)]
      ]))
      
      // Should produce error due to validation failure
      const error = outputs.get('__error')?.value as any
      expect(error?.tag).toBe('contradiction')
      expect(error?.value).toContain('Invalid behavior')
    })
    
    it('should accept behavior that passes validation', () => {
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
      
      const safeBehavior: BehaviorSpec = {
        compute: {
          type: 'propagate',
          from: 'input',
          to: 'output'
        }
      }
      
      const validator = {
        type: 'sandbox',
        deny: ['spawn', 'delete']  // Doesn't include 'propagate'
      }
      
      const outputs = gadget.compute!(new Map([
        ['__behavior', signal(safeBehavior, 1.0)],
        ['__validator', signal(validator, 1.0)],
        ['input', signal('test', 0.5)]
      ]))
      
      // Should propagate successfully
      expect(outputs.get('output')?.value).toBe('test')
      expect(outputs.get('__error')).toBeUndefined()
    })
  })
  
  describe('Conditional Spawning', () => {
    it('should spawn different templates based on condition', () => {
      const condSpawner = createConditionalSpawner('cond')
      
      const templateA: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: { 'a': { direction: 'output' } }
            }
          }
        }
      }
      
      const templateB: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: { 'b': { direction: 'output' } }
            }
          }
        }
      }
      
      // Test true condition
      const outputs1 = condSpawner.compute!(new Map([
        ['condition', signal(true, 1.0)],
        ['ifTrue', signal(templateA, 1.0)],
        ['ifFalse', signal(templateB, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      const instance1 = outputs1.get('spawned')?.value as InstanceSignal
      const gadget1 = instance1?.value.gadget.deref()
      expect(gadget1?.contacts.has('a')).toBe(true)
      expect(gadget1?.contacts.has('b')).toBe(false)
      
      // Test false condition
      const condSpawner2 = createConditionalSpawner('cond2')
      const outputs2 = condSpawner2.compute!(new Map([
        ['condition', signal(false, 1.0)],
        ['ifTrue', signal(templateA, 1.0)],
        ['ifFalse', signal(templateB, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      const instance2 = outputs2.get('spawned')?.value as InstanceSignal
      const gadget2 = instance2?.value.gadget.deref()
      expect(gadget2?.contacts.has('a')).toBe(false)
      expect(gadget2?.contacts.has('b')).toBe(true)
    })
  })
  
  describe('Garbage Collection', () => {
    it('should remove weak gadgets', () => {
      const parent = createGadget('parent')
      const gc = createGarbageCollector('gc')
      
      // Add GC to parent
      parent.gadgets.set('gc', gc)
      gc.parent = new WeakRef(parent)
      
      // Add some children with different strengths
      const strong = createGadget('strong')
      const weak = createGadget('weak')
      
      const strongOut = createContact('output', strong, signal('data', 0.5), 'output')
      const weakOut = createContact('output', weak, signal('data', 0.005), 'output')
      
      strong.contacts.set('output', strongOut)
      weak.contacts.set('output', weakOut)
      
      parent.gadgets.set('strong', strong)
      parent.gadgets.set('weak', weak)
      
      expect(parent.gadgets.size).toBe(3)  // gc, strong, weak
      
      // Run garbage collection
      const outputs = gc.compute!(new Map([
        ['threshold', signal(100, 1.0)],  // 100 units threshold
        ['check', signal(true, 1.0)]
      ]))
      
      const removed = outputs.get('removed')?.value as string[]
      expect(removed).toContain('weak')
      expect(removed).not.toContain('strong')
      expect(parent.gadgets.size).toBe(2)  // gc, strong
    })
    
    it('should not remove itself during GC', () => {
      const parent = createGadget('parent')
      const gc = createGarbageCollector('gc')
      
      parent.gadgets.set('gc', gc)
      gc.parent = new WeakRef(parent)
      
      // GC has weak outputs
      const gcOut = createContact('removed', gc, signal([], 0.01), 'output')
      gc.contacts.set('removed', gcOut)
      
      const outputs = gc.compute!(new Map([
        ['threshold', signal(100, 1.0)],
        ['check', signal(true, 1.0)]
      ]))
      
      // GC should still exist
      expect(parent.gadgets.has('gc')).toBe(true)
    })
  })
  
  describe('Evolution Edge Cases', () => {
    it('should handle expired gadget references', () => {
      const evolver = createEvolver('evolver')
      
      // Create instance with invalid reference (empty object lacks gainPool)
      const expiredInstance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'expired',
          gadget: new WeakRef({} as any),  // Invalid gadget - no gainPool
          born: Date.now(),
          generation: 1
        }
      }
      
      const validGadget = createGadget('valid')
      validGadget.gainPool = 100
      const validInstance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'valid',
          gadget: new WeakRef(validGadget),
          born: Date.now(),
          generation: 2
        }
      }
      
      const outputs = evolver.compute!(new Map([
        ['old', signal(expiredInstance, 1.0)],
        ['new', signal(validInstance, 1.0)],
        ['rate', signal(100, 1.0)]
      ]))
      
      // Should handle gracefully - undefined gainPool results in no transfer
      const status = outputs.get('status')?.value as any
      expect(status.oldGain).toBeUndefined()  // Invalid gadget has no gainPool
      expect(status.newGain).toBe(100)  // Valid gadget unchanged
      expect(status.transferred).toBe(0)  // Nothing transferred
    })
    
    it('should respect threshold during evolution', () => {
      const evolver = createEvolver('evolver')
      
      const oldGadget = createGadget('old')
      oldGadget.gainPool = 200
      
      const newGadget = createGadget('new')
      newGadget.gainPool = 0
      
      const oldInstance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'old',
          gadget: new WeakRef(oldGadget),
          born: Date.now(),
          generation: 1
        }
      }
      
      const newInstance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'new',
          gadget: new WeakRef(newGadget),
          born: Date.now(),
          generation: 2
        }
      }
      
      const outputs = evolver.compute!(new Map([
        ['old', signal(oldInstance, 1.0)],
        ['new', signal(newInstance, 1.0)],
        ['rate', signal(150, 1.0)],  // Want to transfer 150
        ['threshold', signal(100, 1.0)]  // But keep at least 100
      ]))
      
      const status = outputs.get('status')?.value as any
      expect(status.transferred).toBe(100)  // Only 100 transferred
      expect(oldGadget.gainPool).toBe(100)  // At threshold
      expect(newGadget.gainPool).toBe(100)
    })
  })
  
  describe('Iterator Advanced', () => {
    it('should handle empty data array', () => {
      const iterator = createIterator('iter')
      
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
      
      const outputs = iterator.compute!(new Map([
        ['template', signal(template, 1.0)],
        ['count', signal(3, 1.0)],
        ['data', signal([], 1.0)],  // Empty array
        ['trigger', signal(true, 1.0)]
      ]))
      
      const instances = outputs.get('instances')?.value as InstanceSignal[]
      expect(instances).toHaveLength(3)
      
      // All should be created but without data
      for (let i = 0; i < 3; i++) {
        const item = iterator.gadgets.get(`item_${i}`)
        expect(item).toBeDefined()
      }
    })
    
    it('should chain instances correctly', () => {
      const iterator = createIterator('chain')
      
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
      
      iterator.compute!(new Map([
        ['template', signal(template, 1.0)],
        ['count', signal(3, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      // Verify chain: item_0.output -> item_1.input -> item_2.input
      const item0 = iterator.gadgets.get('item_0')!
      const item1 = iterator.gadgets.get('item_1')!
      const item2 = iterator.gadgets.get('item_2')!
      
      const out0 = item0.contacts.get('output')!
      const in1 = item1.contacts.get('input')!
      const out1 = item1.contacts.get('output')!
      const in2 = item2.contacts.get('input')!
      
      // Check connections exist
      let found01 = false
      for (const ref of out0.targets) {
        if (ref.deref() === in1) found01 = true
      }
      expect(found01).toBe(true)
      
      let found12 = false
      for (const ref of out1.targets) {
        if (ref.deref() === in2) found12 = true
      }
      expect(found12).toBe(true)
    })
  })
  
  describe('Receipt Generation', () => {
    it('should generate receipts for spawning', () => {
      const spawner = createSpawner('receipt-spawner')
      provideSpawnerGain(spawner, 500, 'test')
      
      const template: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: { 'output': { direction: 'output' } }
            }
          }
        }
      }
      
      spawner.compute!(new Map([
        ['template', signal(template, 1.0)],
        ['initialGain', signal(500, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      const receipts = getAllReceipts()
      expect(receipts.length).toBeGreaterThan(0)
      
      const spawnReceipt = receipts.find(r => 
        r.gadgetId === 'receipt-spawner' && r.reason.includes('Spawned')
      )
      expect(spawnReceipt).toBeDefined()
      expect(spawnReceipt?.amount).toBe(500)
      expect(spawnReceipt?.reason).toContain('Spawned')
    })
    
    it('should generate receipts for evolution transfers', () => {
      clearReceipts()
      
      const evolver = createEvolver('receipt-evolver')
      const old = createGadget('old')
      const newG = createGadget('new')
      
      old.gainPool = 1000
      newG.gainPool = 100
      
      const oldInstance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'old',
          gadget: new WeakRef(old),
          born: Date.now(),
          generation: 1
        }
      }
      
      const newInstance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'new',
          gadget: new WeakRef(newG),
          born: Date.now(),
          generation: 2
        }
      }
      
      evolver.compute!(new Map([
        ['old', signal(oldInstance, 1.0)],
        ['new', signal(newInstance, 1.0)],
        ['rate', signal(200, 1.0)]
      ]))
      
      const receipts = getAllReceipts()
      const evolutionReceipt = receipts.find(r => r.gadgetId === 'receipt-evolver')
      expect(evolutionReceipt).toBeDefined()
      expect(evolutionReceipt?.amount).toBe(200)
      expect(evolutionReceipt?.reason).toContain('Evolution transfer')
    })
  })
})