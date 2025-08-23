/**
 * Tests for behavior composition and template manipulation
 */

import { describe, it, expect } from 'vitest'
import {
  createDynamicGadget,
  signal,
  propagate,
  type DynamicGadgetSpec,
  type BehaviorSpec,
  type ComputeSpec,
  type TemplateSignal
} from '../src'

describe('Behavior Composition', () => {
  describe('Compute Types', () => {
    it('should execute expression compute', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'a': { direction: 'input' },
            'b': { direction: 'input' },
            'sum': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('expr-test', spec)
      
      const behavior: BehaviorSpec = {
        compute: {
          type: 'expression',
          expr: {
            op: 'add',
            args: { a: 'a', b: 'b' }
          }
        }
      }
      
      const outputs = gadget.compute!(new Map([
        ['__behavior', signal(behavior, 1.0)],
        ['a', signal(5, 1.0)],
        ['b', signal(3, 1.0)]
      ]))
      
      expect(outputs.get('output')?.value).toBe(8)
    })
    
    it('should execute conditional compute', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'test': { direction: 'input' },
            'result': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('cond-test', spec)
      
      const behavior: BehaviorSpec = {
        compute: {
          type: 'conditional',
          condition: { op: 'get', args: { name: 'test' } },
          then: {
            type: 'expression',
            expr: { op: 'constant', args: { value: 'yes', strength: 10000 } }
          },
          else: {
            type: 'expression',
            expr: { op: 'constant', args: { value: 'no', strength: 10000 } }
          }
        }
      }
      
      // Test true case
      const outputs1 = gadget.compute!(new Map([
        ['__behavior', signal(behavior, 1.0)],
        ['test', signal(true, 1.0)]
      ]))
      expect(outputs1.get('output')?.value).toBe('yes')
      
      // Test false case
      const outputs2 = gadget.compute!(new Map([
        ['__behavior', signal(behavior, 1.0)],
        ['test', signal(false, 1.0)]
      ]))
      expect(outputs2.get('output')?.value).toBe('no')
    })
    
    it('should execute sequence compute', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'input': { direction: 'input' },
            'output': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('seq-test', spec)
      
      const behavior: BehaviorSpec = {
        compute: {
          type: 'sequence',
          steps: [
            {
              type: 'expression',
              expr: { op: 'constant', args: { value: 'step1' } }
            },
            {
              type: 'expression',
              expr: { op: 'constant', args: { value: 'step2' } }
            },
            {
              type: 'expression',
              expr: { op: 'constant', args: { value: 'final' } }
            }
          ]
        }
      }
      
      const outputs = gadget.compute!(new Map([
        ['__behavior', signal(behavior, 1.0)]
      ]))
      
      // Sequence returns last step's result
      expect(outputs.get('output')?.value).toBe('final')
    })
    
    it('should execute propagate compute', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'source': { direction: 'input' },
            'dest': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('prop-test', spec)
      
      const behavior: BehaviorSpec = {
        compute: {
          type: 'propagate',
          from: 'source',
          to: 'dest'
        }
      }
      
      const outputs = gadget.compute!(new Map([
        ['__behavior', signal(behavior, 1.0)],
        ['source', signal('data', 80)]
      ]))
      
      expect(outputs.get('dest')?.value).toBe('data')
      expect(outputs.get('dest')?.weight).toBe(80)
    })
  })
  
  describe('Nested Behaviors', () => {
    it('should handle nested conditional behaviors', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'a': { direction: 'input' },
            'b': { direction: 'input' },
            'result': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('nested', spec)
      
      // Nested if-then-else
      const behavior: BehaviorSpec = {
        compute: {
          type: 'conditional',
          condition: { op: 'get', args: { name: 'a' } },
          then: {
            type: 'conditional',
            condition: { op: 'get', args: { name: 'b' } },
            then: {
              type: 'expression',
              expr: { op: 'constant', args: { value: 'both' } }
            },
            else: {
              type: 'expression',
              expr: { op: 'constant', args: { value: 'only-a' } }
            }
          },
          else: {
            type: 'expression',
            expr: { op: 'constant', args: { value: 'neither' } }
          }
        }
      }
      
      // Test all cases
      const case1 = gadget.compute!(new Map([
        ['__behavior', signal(behavior, 1.0)],
        ['a', signal(true, 1.0)],
        ['b', signal(true, 1.0)]
      ]))
      expect(case1.get('output')?.value).toBe('both')
      
      const case2 = gadget.compute!(new Map([
        ['__behavior', signal(behavior, 1.0)],
        ['a', signal(true, 1.0)],
        ['b', signal(false, 1.0)]
      ]))
      expect(case2.get('output')?.value).toBe('only-a')
      
      const case3 = gadget.compute!(new Map([
        ['__behavior', signal(behavior, 1.0)],
        ['a', signal(false, 1.0)],
        ['b', signal(true, 1.0)]
      ]))
      expect(case3.get('output')?.value).toBe('neither')
    })
  })
  
  describe('Template as Signals', () => {
    it('should handle templates as regular values', () => {
      const template1: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: { 'x': { direction: 'input' } }
            }
          }
        }
      }
      
      const template2: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: { 'y': { direction: 'input' } }
            }
          }
        }
      }
      
      // Templates can flow through contacts
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'templateIn': { direction: 'input' },
            'templateOut': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('template-router', spec)
      
      const behavior: BehaviorSpec = {
        compute: {
          type: 'propagate',
          from: 'templateIn',
          to: 'templateOut'
        }
      }
      
      const outputs = gadget.compute!(new Map([
        ['__behavior', signal(behavior, 1.0)],
        ['templateIn', signal(template1, 50)]
      ]))
      
      const outTemplate = outputs.get('templateOut')?.value as TemplateSignal
      expect(outTemplate.tag).toBe('template')
      expect(outTemplate.value.spec?.structure.contacts).toHaveProperty('x')
    })
    
    it('should allow template selection based on condition', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'selector': { direction: 'input' },
            'template1': { direction: 'input' },
            'template2': { direction: 'input' },
            'selected': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('template-selector', spec)
      
      const behavior: BehaviorSpec = {
        compute: {
          type: 'conditional',
          condition: { op: 'get', args: { name: 'selector' } },
          then: { type: 'propagate', from: 'template1', to: 'selected' },
          else: { type: 'propagate', from: 'template2', to: 'selected' }
        }
      }
      
      const template1: TemplateSignal = {
        tag: 'template',
        value: { spec: { structure: { contacts: { 'a': { direction: 'input' } } } } }
      }
      
      const template2: TemplateSignal = {
        tag: 'template',
        value: { spec: { structure: { contacts: { 'b': { direction: 'input' } } } } }
      }
      
      const outputs = gadget.compute!(new Map([
        ['__behavior', signal(behavior, 1.0)],
        ['selector', signal(true, 1.0)],
        ['template1', signal(template1, 1.0)],
        ['template2', signal(template2, 1.0)]
      ]))
      
      const selected = outputs.get('selected')?.value as TemplateSignal
      expect(selected.value.spec?.structure.contacts).toHaveProperty('a')
      expect(selected.value.spec?.structure.contacts).not.toHaveProperty('b')
    })
  })
  
  describe('Behavior Hot-Swapping', () => {
    it('should allow changing behavior at runtime', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'input': { direction: 'input' },
            'output': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('hot-swap', spec)
      
      const behavior1: BehaviorSpec = {
        compute: {
          type: 'expression',
          expr: { op: 'constant', args: { value: 'behavior1' } }
        }
      }
      
      const behavior2: BehaviorSpec = {
        compute: {
          type: 'expression',
          expr: { op: 'constant', args: { value: 'behavior2' } }
        }
      }
      
      // First behavior
      const outputs1 = gadget.compute!(new Map([
        ['__behavior', signal(behavior1, 1.0)]
      ]))
      expect(outputs1.get('output')?.value).toBe('behavior1')
      
      // Swap to second behavior
      const outputs2 = gadget.compute!(new Map([
        ['__behavior', signal(behavior2, 1.0)]
      ]))
      expect(outputs2.get('output')?.value).toBe('behavior2')
    })
    
    it('should remember bound behavior across compute calls', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'input': { direction: 'input' },
            'output': { direction: 'output' }
          }
        },
        bindings: { behavior: '__behavior' }
      }
      
      const gadget = createDynamicGadget('memory', spec)
      
      const behavior: BehaviorSpec = {
        compute: {
          type: 'propagate',
          from: 'input',
          to: 'output'
        }
      }
      
      // Bind behavior
      gadget.compute!(new Map([
        ['__behavior', signal(behavior, 1.0)],
        ['input', signal('first', 1.0)]
      ]))
      
      // Call without behavior - should remember
      const outputs = gadget.compute!(new Map([
        ['input', signal('second', 1.0)]
      ]))
      
      // Should still propagate using remembered behavior
      expect(outputs.get('output')?.value).toBe('second')
    })
  })
  
  describe('Default Propagation', () => {
    it('should forward signals when no behavior is bound', () => {
      const spec: DynamicGadgetSpec = {
        structure: {
          contacts: {
            'input': { direction: 'input' },
            'output': { direction: 'output' },
            'other': { direction: 'input' }
          }
        }
      }
      
      const gadget = createDynamicGadget('default', spec)
      
      // No behavior bound
      const outputs = gadget.compute!(new Map([
        ['input', signal('data', 50)],
        ['other', signal('ignored', 50)]
      ]))
      
      // Should not forward (no matching output name)
      expect(outputs.size).toBe(0)
    })
  })
})