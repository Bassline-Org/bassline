import { describe, it, expect } from 'vitest'
import { brand } from '../../types'
import type { Bassline, ReifiedContact, ReifiedWire } from '../../bassline-types'
import { createEmptyBassline } from '../../bassline-types'
import { 
  createDynamicBasslineGadget,
  createSimpleComputeBassline,
  createFactorialBassline
} from '../dynamic-bassline-gadget'

describe('Dynamic Bassline Gadget', () => {
  describe('createDynamicBasslineGadget', () => {
    it('should create gadget with correct structure', () => {
      const gadget = createDynamicBasslineGadget()
      
      expect(gadget.id).toBe('dynamic-bassline')
      expect(gadget.name).toBe('Dynamic Bassline')
      expect(gadget.inputs).toEqual([
        'basslineDescription',
        'inputs',
        'run',
        'step',
        'reset'
      ])
      expect(gadget.outputs).toEqual([
        'runningBassline',
        'outputs',
        'completed',
        'iterations',
        'queueSize'
      ])
      expect(gadget.isPure).toBe(false)  // Has internal state
    })

    it('should activate when bassline and command are present', () => {
      const gadget = createDynamicBasslineGadget()
      const bassline = createEmptyBassline()
      
      // Should not activate without bassline
      expect(gadget.activation(new Map([['run', true]]))).toBe(false)
      
      // Should not activate without command
      expect(gadget.activation(new Map([['basslineDescription', bassline]]))).toBe(false)
      
      // Should activate with bassline and run
      expect(gadget.activation(new Map([
        ['basslineDescription', bassline],
        ['run', true]
      ]))).toBe(true)
      
      // Should activate with bassline and step
      expect(gadget.activation(new Map([
        ['basslineDescription', bassline],
        ['step', true]
      ]))).toBe(true)
      
      // Should activate with bassline and reset
      expect(gadget.activation(new Map([
        ['basslineDescription', bassline],
        ['reset', true]
      ]))).toBe(true)
    })

    it('should instantiate and run a simple bassline', async () => {
      const gadget = createDynamicBasslineGadget()
      const bassline = createSimpleComputeBassline()
      
      // Set inputs and run
      const inputs = new Map([
        ['basslineDescription', bassline],
        ['inputs', new Map([
          ['a', 5],
          ['b', 3]
        ])],
        ['run', true]
      ])
      
      const outputs = await gadget.body(inputs)
      
      expect(outputs.get('runningBassline')).toBe(bassline)
      expect(outputs.get('completed')).toBe(true)
      
      const values = outputs.get('outputs') as Map<string, any>
      expect(values).toBeInstanceOf(Map)
      expect(values.get('a')).toBe(5)
      expect(values.get('b')).toBe(3)
      // Now with proper gadget execution, sum should compute correctly
      expect(values.get('sum')).toBe(8)
    })

    it('should handle incremental input updates', async () => {
      const gadget = createDynamicBasslineGadget()
      const bassline = createSimpleComputeBassline()
      
      // First set only 'a'
      const step1Inputs = new Map([
        ['basslineDescription', bassline],
        ['inputs', new Map([['a', 10]])],
        ['run', true]
      ])
      
      const step1Outputs = await gadget.body(step1Inputs)
      expect(step1Outputs.get('completed')).toBe(true)
      
      const values1 = step1Outputs.get('outputs') as Map<string, any>
      expect(values1.get('a')).toBe(10)
      expect(values1.get('b')).toBe(0)  // Still default
      
      // Now set 'b' and run again
      const step2Inputs = new Map([
        ['basslineDescription', bassline],
        ['inputs', new Map([['b', 20]])],
        ['run', true]
      ])
      
      const step2Outputs = await gadget.body(step2Inputs)
      expect(step2Outputs.get('completed')).toBe(true)
      
      const values2 = step2Outputs.get('outputs') as Map<string, any>
      expect(values2.get('a')).toBe(10)  // Preserved from step 1
      expect(values2.get('b')).toBe(20)  // Set in step 2
      expect(values2.get('sum')).toBe(30) // Computed correctly
    })

    it('should reset bassline state when requested', async () => {
      const gadget = createDynamicBasslineGadget()
      const bassline = createSimpleComputeBassline()
      
      // Run with initial values
      const runInputs = new Map([
        ['basslineDescription', bassline],
        ['inputs', new Map([
          ['a', 100],
          ['b', 200]
        ])],
        ['run', true]
      ])
      
      await gadget.body(runInputs)
      
      // Reset and run with new values
      const resetInputs = new Map([
        ['basslineDescription', bassline],
        ['inputs', new Map([
          ['a', 1],
          ['b', 2]
        ])],
        ['reset', true],
        ['run', true]
      ])
      
      const outputs = await gadget.body(resetInputs)
      const values = outputs.get('outputs') as Map<string, any>
      
      expect(values.get('a')).toBe(1)  // New value, not 100
      expect(values.get('b')).toBe(2)  // New value, not 200
    })

    it('should handle empty bassline', async () => {
      const gadget = createDynamicBasslineGadget()
      const emptyBassline = createEmptyBassline()
      
      const inputs = new Map([
        ['basslineDescription', emptyBassline],
        ['run', true]
      ])
      
      const outputs = await gadget.body(inputs)
      
      expect(outputs.get('runningBassline')).toBe(emptyBassline)
      expect(outputs.get('completed')).toBe(true)
      expect(outputs.get('iterations')).toBe(0)
      
      const values = outputs.get('outputs') as Map<string, any>
      expect(values.size).toBe(0)
    })

    it('should return empty map when no bassline provided', async () => {
      const gadget = createDynamicBasslineGadget()
      
      const inputs = new Map([['run', true]])
      const outputs = await gadget.body(inputs)
      
      expect(outputs.size).toBe(0)
    })
  })

  describe('createSimpleComputeBassline', () => {
    it('should create a bassline with input and output contacts', () => {
      const bassline = createSimpleComputeBassline()
      
      expect(bassline.contacts.size).toBe(3)
      expect(bassline.contacts.has('a' as any)).toBe(true)
      expect(bassline.contacts.has('b' as any)).toBe(true)
      expect(bassline.contacts.has('sum' as any)).toBe(true)
      
      const a = bassline.contacts.get('a' as any)
      expect(a?.isBoundary).toBe(true)
      expect(a?.boundaryDirection).toBe('input')
      
      const sum = bassline.contacts.get('sum' as any)
      expect(sum?.isBoundary).toBe(true)
      expect(sum?.boundaryDirection).toBe('output')
    })

    it('should create add gadget with proper structure', () => {
      const bassline = createSimpleComputeBassline()
      
      // Check group exists with primitive
      expect(bassline.groups.size).toBe(1)
      const group = bassline.groups.get('add-group' as any)
      expect(group?.primitive?.id).toBe('add')
      
      // Check gadget is registered
      expect(bassline.gadgets.size).toBe(1)
      const gadget = bassline.gadgets.get('add-gadget-instance')
      expect(gadget?.type).toBe('primitive')
      expect(gadget?.primitive).toBe('add')
      
      // No wires needed - gadget handles computation internally
      expect(bassline.wires.size).toBe(0)
    })
  })

  describe('createFactorialBassline', () => {
    it('should create a factorial bassline structure', () => {
      const bassline = createFactorialBassline()
      
      expect(bassline.contacts.size).toBe(5)
      expect(bassline.contacts.has('n' as any)).toBe(true)
      expect(bassline.contacts.has('result' as any)).toBe(true)
      expect(bassline.contacts.has('is-zero' as any)).toBe(true)
      expect(bassline.contacts.has('n-minus-1' as any)).toBe(true)
      expect(bassline.contacts.has('recursive-result' as any)).toBe(true)
      
      const n = bassline.contacts.get('n' as any)
      expect(n?.isBoundary).toBe(true)
      expect(n?.boundaryDirection).toBe('input')
      
      const result = bassline.contacts.get('result' as any)
      expect(result?.isBoundary).toBe(true)
      expect(result?.boundaryDirection).toBe('output')
    })

    it('should have spawn capability for recursion', () => {
      const bassline = createFactorialBassline()
      
      expect(bassline.capabilities.has('bassline.spawn')).toBe(true)
    })
  })

  describe('Propagation behavior', () => {
    it('should propagate values through wires', async () => {
      const gadget = createDynamicBasslineGadget()
      
      // Create a simple propagation network
      const bassline = createEmptyBassline()
      
      // Add contacts
      const c1: ReifiedContact = {
        id: 'c1' as any,
        groupId: 'test' as any,
        content: undefined,
        blendMode: 'accept-last'
      }
      
      const c2: ReifiedContact = {
        id: 'c2' as any,
        groupId: 'test' as any,
        content: undefined,
        blendMode: 'accept-last'
      }
      
      const c3: ReifiedContact = {
        id: 'c3' as any,
        groupId: 'test' as any,
        content: undefined,
        blendMode: 'accept-last'
      }
      
      bassline.contacts.set(c1.id, c1)
      bassline.contacts.set(c2.id, c2)
      bassline.contacts.set(c3.id, c3)
      
      // Add wires: c1 -> c2 -> c3
      const w1: ReifiedWire = {
        id: 'w1' as any,
        groupId: 'test' as any,
        fromId: c1.id,
        toId: c2.id,
        type: 'directed'
      }
      
      const w2: ReifiedWire = {
        id: 'w2' as any,
        groupId: 'test' as any,
        fromId: c2.id,
        toId: c3.id,
        type: 'directed'
      }
      
      bassline.wires.set(w1.id, w1)
      bassline.wires.set(w2.id, w2)
      
      // Run with initial value
      const inputs = new Map([
        ['basslineDescription', bassline],
        ['inputs', new Map([['c1', 'propagated']])],
        ['run', true]
      ])
      
      const outputs = await gadget.body(inputs)
      const values = outputs.get('outputs') as Map<string, any>
      
      // Value should propagate through the chain
      expect(values.get('c1')).toBe('propagated')
      expect(values.get('c2')).toBe('propagated')
      expect(values.get('c3')).toBe('propagated')
    })

    it('should handle bidirectional wires', async () => {
      const gadget = createDynamicBasslineGadget()
      
      const bassline = createEmptyBassline()
      
      // Add two contacts
      const c1: ReifiedContact = {
        id: 'c1' as any,
        groupId: 'test' as any,
        content: undefined,
        blendMode: 'accept-last'
      }
      
      const c2: ReifiedContact = {
        id: 'c2' as any,
        groupId: 'test' as any,
        content: undefined,
        blendMode: 'accept-last'
      }
      
      bassline.contacts.set(c1.id, c1)
      bassline.contacts.set(c2.id, c2)
      
      // Add bidirectional wire
      const wire: ReifiedWire = {
        id: 'w1' as any,
        groupId: 'test' as any,
        fromId: c1.id,
        toId: c2.id,
        type: 'bidirectional'
      }
      
      bassline.wires.set(wire.id, wire)
      
      // Set value on c2, should propagate to c1
      const inputs = new Map([
        ['basslineDescription', bassline],
        ['inputs', new Map([['c2', 'from-c2']])],
        ['run', true]
      ])
      
      const outputs = await gadget.body(inputs)
      const values = outputs.get('outputs') as Map<string, any>
      
      expect(values.get('c1')).toBe('from-c2')
      expect(values.get('c2')).toBe('from-c2')
    })
  })
})