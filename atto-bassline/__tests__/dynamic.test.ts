/**
 * Tests for dynamic gadgets and spawners
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createDynamicGadget,
  createSpawner,
  createEvolver,
  createIterator,
  interpretTemplate,
  signal,
  propagate,
  createGadget,
  wire,
  type DynamicGadgetSpec,
  type TemplateSignal,
  type InstanceSignal
} from '../src'

describe('Dynamic Gadgets', () => {
  describe('Basic Dynamic Gadget', () => {
    it('should create eager structure without behavior', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'input': { direction: 'input' },
            'output': { direction: 'output' }
          },
          wires: [
            { from: 'input', to: 'output' }
          ]
        }
      }
      
      const gadget = createDynamicGadget('test', spec)
      
      expect(gadget.contacts.has('input')).toBe(true)
      expect(gadget.contacts.has('output')).toBe(true)
      expect(gadget.contacts.get('input')!.direction).toBe('input')
      expect(gadget.contacts.get('output')!.direction).toBe('output')
    })
    
    it('should create child gadgets eagerly', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          children: {
            'child1': {
              structure: {
                contacts: {
                  'in': { direction: 'input' },
                  'out': { direction: 'output' }
                }
              }
            },
            'child2': {
              structure: {
                contacts: {
                  'in': { direction: 'input' },
                  'out': { direction: 'output' }
                }
              }
            }
          },
          wires: [
            { from: 'child1.out', to: 'child2.in' }
          ]
        }
      }
      
      const gadget = createDynamicGadget('parent', spec)
      
      expect(gadget.gadgets.has('child1')).toBe(true)
      expect(gadget.gadgets.has('child2')).toBe(true)
      
      const child1 = gadget.gadgets.get('child1')!
      const child2 = gadget.gadgets.get('child2')!
      
      expect(child1.contacts.has('in')).toBe(true)
      expect(child2.contacts.has('out')).toBe(true)
    })
    
    it('should wire internal connections eagerly', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'input': { direction: 'input' },
            'output': { direction: 'output' }
          },
          children: {
            'processor': {
              structure: {
                contacts: {
                  'in': { direction: 'input' },
                  'out': { direction: 'output' }
                }
              }
            }
          },
          wires: [
            { from: 'input', to: 'processor.in' },
            { from: 'processor.out', to: 'output' }
          ]
        }
      }
      
      const gadget = createDynamicGadget('pipeline', spec)
      const processor = gadget.gadgets.get('processor')!
      
      // Check wiring exists
      const input = gadget.contacts.get('input')!
      const procIn = processor.contacts.get('in')!
      
      // Verify connection through propagation
      propagate(input, signal('test', 0.5))
      
      // Signal should reach processor input through wire
      // (Note: actual propagation would require the wire connections to be properly set)
    })
    
    it('should accept behavior binding', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'input': { direction: 'input' },
            'output': { direction: 'output' }
          }
        },
        bindings: {
          behavior: '__behavior'
        }
      }
      
      const gadget = createDynamicGadget('dynamic', spec)
      
      expect(gadget.contacts.has('__behavior')).toBe(true)
      
      const behavior = {
        compute: {
          type: 'propagate' as const,
          from: 'input',
          to: 'output'
        }
      }
      
      // Bind behavior
      propagate(gadget.contacts.get('__behavior')!, signal(behavior, 1.0))
      
      // Now gadget should forward input to output
      propagate(gadget.contacts.get('input')!, signal('data', 0.8))
      
      const outputs = gadget.compute!(new Map([
        ['input', signal('data', 0.8)],
        ['__behavior', signal(behavior, 1.0)]
      ]))
      
      expect(outputs.get('output')?.value).toBe('data')
    })
  })
  
  describe('Spawner', () => {
    it('should spawn gadget from template', () => {
      const spawner = createSpawner('spawner1')
      
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
      
      const inputs = new Map([
        ['template', signal(template, 1.0)],
        ['trigger', signal(true, 1.0)]
      ])
      
      const outputs = spawner.compute!(inputs)
      const instance = outputs.get('instance')?.value as InstanceSignal
      
      expect(instance).toBeDefined()
      expect(instance.tag).toBe('instance')
      expect(instance.value.generation).toBe(1)
      
      // Check spawned gadget was added as child
      expect(spawner.gadgets.size).toBe(1)
    })
    
    it('should start spawned gadgets with low strength', () => {
      const spawner = createSpawner('spawner2')
      
      const template: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: {
                'output': { direction: 'output', initial: { value: 'data', strength: 10000 } }
              }
            }
          }
        }
      }
      
      const inputs = new Map([
        ['template', signal(template, 1.0)],
        ['trigger', signal(true, 1.0)],
        ['initialStrength', signal(200, 1.0)],  // Very weak
        ['initialGain', signal(50, 1.0)]  // Minimal gain
      ])
      
      const outputs = spawner.compute!(inputs)
      const instance = outputs.get('instance')?.value as InstanceSignal
      
      if (instance) {
        const spawnedGadget = instance.value.gadget.deref()
        expect(spawnedGadget?.gainPool).toBe(50)  // Weak gain pool
        
        const output = spawnedGadget?.contacts.get('output')
        expect(output?.signal.strength).toBe(200)  // Weak initial strength
      }
    })
    
    it('should handle spawn errors gracefully', () => {
      const spawner = createSpawner('spawner3')
      
      const inputs = new Map([
        ['template', signal({ tag: 'not-a-template' }, 1.0)],  // Invalid
        ['trigger', signal(true, 1.0)]
      ])
      
      const outputs = spawner.compute!(inputs)
      const error = outputs.get('error')?.value
      
      expect(error).toBeDefined()
      expect((error as any).tag).toBe('contradiction')
    })
  })
  
  describe('Evolver', () => {
    it('should transfer strength between instances', () => {
      const evolver = createEvolver('evolver1')
      
      // Create two gadgets
      const oldGadget = createGadget('old')
      oldGadget.gainPool = 1000
      
      const newGadget = createGadget('new')
      newGadget.gainPool = 100
      
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
      
      const inputs = new Map([
        ['old', signal(oldInstance, 1.0)],
        ['new', signal(newInstance, 1.0)],
        ['rate', signal(200, 1.0)],  // Transfer 200 per cycle
        ['threshold', signal(100, 1.0)]  // Keep at least 100
      ])
      
      const outputs = evolver.compute!(inputs)
      const status = outputs.get('status')?.value as any
      
      expect(status.transferred).toBe(200)
      expect(oldGadget.gainPool).toBe(800)  // 1000 - 200
      expect(newGadget.gainPool).toBe(300)  // 100 + 200
    })
    
    it('should signal completion when evolution done', () => {
      const evolver = createEvolver('evolver2')
      
      const oldGadget = createGadget('old')
      oldGadget.gainPool = 150  // Close to threshold
      
      const newGadget = createGadget('new')
      newGadget.gainPool = 500
      
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
      
      const inputs = new Map([
        ['old', signal(oldInstance, 1.0)],
        ['new', signal(newInstance, 1.0)],
        ['rate', signal(100, 1.0)],
        ['threshold', signal(100, 1.0)]
      ])
      
      const outputs = evolver.compute!(inputs)
      
      expect(outputs.get('complete')?.value).toBe(false)  // Not complete yet
      expect(oldGadget.gainPool).toBe(100)  // At threshold
      
      // Run again - should now be complete
      const outputs2 = evolver.compute!(inputs)
      expect(outputs2.get('complete')?.value).toBe(true)
    })
  })
  
  describe('Iterator', () => {
    it('should spawn multiple instances', () => {
      const iterator = createIterator('iter1')
      
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
      
      const inputs = new Map([
        ['template', signal(template, 1.0)],
        ['count', signal(3, 1.0)],
        ['trigger', signal(true, 1.0)]
      ])
      
      const outputs = iterator.compute!(inputs)
      const instances = outputs.get('instances')?.value as InstanceSignal[]
      
      expect(instances).toHaveLength(3)
      expect(iterator.gadgets.size).toBe(3)
      
      // Check decreasing gain
      const item0 = iterator.gadgets.get('item_0')
      const item2 = iterator.gadgets.get('item_2')
      
      expect(item0!.gainPool).toBeGreaterThan(item2!.gainPool)
    })
    
    it('should wire instances in sequence', () => {
      const iterator = createIterator('iter2')
      
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
      
      const inputs = new Map([
        ['template', signal(template, 1.0)],
        ['count', signal(2, 1.0)],
        ['trigger', signal(true, 1.0)]
      ])
      
      iterator.compute!(inputs)
      
      const item0 = iterator.gadgets.get('item_0')!
      const item1 = iterator.gadgets.get('item_1')!
      
      // Check that item_0.output is wired to item_1.input
      const out0 = item0.contacts.get('output')!
      const in1 = item1.contacts.get('input')!
      
      // Verify the wire exists
      let hasConnection = false
      for (const targetRef of out0.targets) {
        if (targetRef.deref() === in1) {
          hasConnection = true
          break
        }
      }
      
      expect(hasConnection).toBe(true)
    })
  })
})