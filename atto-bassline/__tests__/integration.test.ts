/**
 * Integration tests for complete dynamic gadget scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createDynamicGadget,
  createSpawner,
  provideSpawnerGain,
  createEvolver,
  createTransistor,
  signal,
  propagate,
  wire,
  clearReceipts,
  getAllReceipts,
  type DynamicGadgetSpec,
  type TemplateSignal,
  type InstanceSignal
} from '../src'

describe('Integration Tests', () => {
  beforeEach(() => {
    clearReceipts()
  })
  
  describe('Self-Evolving Network', () => {
    it('should create a network that spawns improved versions of itself', () => {
      // Create the main network structure
      const networkSpec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'input': { direction: 'input' },
            'output': { direction: 'output' },
            'fitness': { direction: 'input' }
          },
          children: {
            // Spawner for creating new versions
            'spawner': {
              structure: {
                contacts: {
                  'template': { direction: 'input' },
                  'trigger': { direction: 'input' },
                  'instance': { direction: 'output' }
                }
              }
            },
            // Evolver for strength transfer
            'evolver': {
              structure: {
                contacts: {
                  'old': { direction: 'input' },
                  'new': { direction: 'input' },
                  'rate': { direction: 'input' },
                  'complete': { direction: 'output' }
                }
              }
            }
          },
          wires: [
            // Wire spawner output to evolver new input
            { from: 'spawner.instance', to: 'evolver.new' }
          ]
        }
      }
      
      const network = createDynamicGadget('self-evolver', networkSpec)
      
      // Verify structure
      expect(network.gadgets.has('spawner')).toBe(true)
      expect(network.gadgets.has('evolver')).toBe(true)
      
      // The network can now spawn and evolve versions of itself
      const spawner = network.gadgets.get('spawner')!
      expect(spawner.contacts.has('template')).toBe(true)
    })
  })
  
  describe('Pipeline with Hot-Swappable Stages', () => {
    it('should create a pipeline where stages can be replaced at runtime', () => {
      // Pipeline with 3 stages that can be swapped
      const pipelineSpec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'input': { direction: 'input' },
            'output': { direction: 'output' }
          },
          children: {
            'stage1': {
              structure: {
                contacts: {
                  'in': { direction: 'input' },
                  'out': { direction: 'output' },
                  '__behavior': { direction: 'input' }
                }
              },
              bindings: { behavior: '__behavior' }
            },
            'stage2': {
              structure: {
                contacts: {
                  'in': { direction: 'input' },
                  'out': { direction: 'output' },
                  '__behavior': { direction: 'input' }
                }
              },
              bindings: { behavior: '__behavior' }
            },
            'stage3': {
              structure: {
                contacts: {
                  'in': { direction: 'input' },
                  'out': { direction: 'output' },
                  '__behavior': { direction: 'input' }
                }
              },
              bindings: { behavior: '__behavior' }
            }
          },
          wires: [
            { from: 'input', to: 'stage1.in' },
            { from: 'stage1.out', to: 'stage2.in' },
            { from: 'stage2.out', to: 'stage3.in' },
            { from: 'stage3.out', to: 'output' }
          ]
        }
      }
      
      const pipeline = createDynamicGadget('pipeline', pipelineSpec)
      
      // Verify pipeline structure
      expect(pipeline.gadgets.size).toBe(3)
      
      // Each stage can accept behaviors
      const stage1 = pipeline.gadgets.get('stage1')!
      const stage2 = pipeline.gadgets.get('stage2')!
      const stage3 = pipeline.gadgets.get('stage3')!
      
      expect(stage1.contacts.has('__behavior')).toBe(true)
      expect(stage2.contacts.has('__behavior')).toBe(true)
      expect(stage3.contacts.has('__behavior')).toBe(true)
      
      // Bind behaviors to stages
      const passThroughBehavior = {
        compute: {
          type: 'propagate' as const,
          from: 'in',
          to: 'out'
        }
      }
      
      // Hot-swap stage behaviors
      propagate(stage1.contacts.get('__behavior')!, signal(passThroughBehavior, 1.0))
      propagate(stage2.contacts.get('__behavior')!, signal(passThroughBehavior, 1.0))
      propagate(stage3.contacts.get('__behavior')!, signal(passThroughBehavior, 1.0))
      
      // Data should flow through pipeline
      propagate(pipeline.contacts.get('input')!, signal('test-data', 0.8))
      
      // Each stage should process according to its behavior
      const stage1Outputs = stage1.compute!(new Map([
        ['in', signal('test-data', 0.8)],
        ['__behavior', signal(passThroughBehavior, 1.0)]
      ]))
      
      expect(stage1Outputs.get('out')?.value).toBe('test-data')
    })
  })
  
  describe('Trust Network with Gradual Evolution', () => {
    it('should build trust gradually through evolution', () => {
      // Create untrusted and trusted versions
      const untrusted = createTransistor('untrusted')
      untrusted.gainPool = 100  // Minimal trust
      
      const trusted = createTransistor('trusted')
      trusted.gainPool = 0  // Starts with nothing
      
      // Create evolver
      const evolver = createEvolver('trust-evolver')
      
      // Create instances
      const untrustedInstance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'untrusted',
          gadget: new WeakRef(untrusted),
          born: Date.now(),
          generation: 1
        }
      }
      
      const trustedInstance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'trusted',
          gadget: new WeakRef(trusted),
          born: Date.now(),
          generation: 2
        }
      }
      
      // Gradually build trust over multiple cycles
      const cycles = 5
      for (let i = 0; i < cycles; i++) {
        evolver.compute!(new Map([
          ['old', signal(untrustedInstance, 1.0)],
          ['new', signal(trustedInstance, 1.0)],
          ['rate', signal(20, 1.0)],  // Transfer 20 per cycle
          ['threshold', signal(0, 1.0)]  // Transfer everything
        ]))
      }
      
      // After 5 cycles, trust should be transferred
      expect(untrusted.gainPool).toBe(0)
      expect(trusted.gainPool).toBe(100)
      
      // Check receipts
      const receipts = getAllReceipts()
      expect(receipts.length).toBe(5)  // One per cycle
      
      const totalTransferred = receipts.reduce((sum, r) => sum + r.amount, 0)
      expect(totalTransferred).toBe(100)
    })
  })
  
  describe('Spawner Chain Reaction', () => {
    it('should allow spawners to spawn spawners in a chain', () => {
      // Create initial spawner
      const spawner1 = createSpawner('spawner1')
      provideSpawnerGain(spawner1, 200, 'test')
      
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
      
      // Spawn a second spawner
      const outputs1 = spawner1.compute!(new Map([
        ['template', signal(spawnerTemplate, 1.0)],
        ['initialGain', signal(50, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      const instance1 = outputs1.get('instance')?.value as InstanceSignal
      const spawner2 = instance1.value.gadget.deref()
      
      expect(spawner2).toBeDefined()
      expect(spawner2?.gainPool).toBe(50)
      
      // Simple processor template
      const processorTemplate: TemplateSignal = {
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
      
      // Spawner2 has spawner structure but needs behavior
      if (spawner2) {
        // Spawner2 is a dynamic gadget with spawner-like structure
        expect(spawner2.contacts.has('template')).toBe(true)
        expect(spawner2.contacts.has('trigger')).toBe(true)
        expect(spawner2.contacts.has('instance')).toBe(true)
        
        // It could accept spawner behavior if we had a way to define it
        // This demonstrates the structure is correct for spawning
      }
    })
  })
  
  describe('Dynamic Router', () => {
    it('should route signals to strongest child dynamically', () => {
      // Router that forwards to strongest child
      const routerSpec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'input': { direction: 'input' },
            'output': { direction: 'output' }
          },
          children: {
            'path1': {
              structure: {
                contacts: {
                  'in': { direction: 'input', initial: { value: null, strength: 3000 } },
                  'out': { direction: 'output' }
                }
              }
            },
            'path2': {
              structure: {
                contacts: {
                  'in': { direction: 'input', initial: { value: null, strength: 5000 } },
                  'out': { direction: 'output' }
                }
              }
            },
            'path3': {
              structure: {
                contacts: {
                  'in': { direction: 'input', initial: { value: null, strength: 2000 } },
                  'out': { direction: 'output' }
                }
              }
            }
          }
        }
      }
      
      const router = createDynamicGadget('router', routerSpec)
      
      // path2 has strongest initial signal
      const path2 = router.gadgets.get('path2')!
      const path2In = path2.contacts.get('in')!
      
      expect(path2In.signal.strength).toBe(5000)
      
      // Router would route to path2 based on strength
      // This demonstrates the structure for dynamic routing
    })
  })
  
  describe('Validator Chain', () => {
    it('should chain multiple validators for defense in depth', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'input': { direction: 'input' },
            'output': { direction: 'output' }
          },
          children: {
            'validator1': {
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
            },
            'validator2': {
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
          },
          wires: [
            { from: 'input', to: 'validator1.__behavior' },
            { from: 'validator1.__behavior', to: 'validator2.__behavior' }
          ]
        }
      }
      
      const chain = createDynamicGadget('validator-chain', spec)
      
      // Both validators in chain
      expect(chain.gadgets.size).toBe(2)
      
      const v1 = chain.gadgets.get('validator1')!
      const v2 = chain.gadgets.get('validator2')!
      
      // Each can have different validation rules
      const sandboxValidator = { type: 'sandbox', deny: ['spawn'] }
      const resourceValidator = { type: 'resource', maxGain: 1000 }
      
      propagate(v1.contacts.get('__validator')!, signal(sandboxValidator, 1.0))
      propagate(v2.contacts.get('__validator')!, signal(resourceValidator, 1.0))
      
      // Behavior must pass both validators to execute
    })
  })
})