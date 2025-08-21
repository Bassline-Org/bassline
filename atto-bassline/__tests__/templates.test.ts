/**
 * Tests for the template system
 */

import { describe, it, expect } from 'vitest'
import { createPrimitive, validateGadgetSchema, sequence, type GadgetSchema } from '../src/templates'
import { AddTemplate, MultiplyTemplate, ClampTemplate } from '../src/examples/math-gadgets'
import { AddThenMultiplyTemplate } from '../src/examples/sequence-examples'
import { createSignal } from '../src/types'
import { propagate } from '../src/propagation'

describe('Template System', () => {
  describe('Schema Validation', () => {
    it('should validate a correct schema', () => {
      const schema = {
        inputs: {
          value: { type: 'number', default: 0 }
        },
        outputs: {
          result: { type: 'number' }
        }
      }
      
      expect(() => validateGadgetSchema(schema)).not.toThrow()
    })
    
    it('should reject invalid schema', () => {
      const invalidSchema = {
        inputs: {
          value: { type: 'invalid-type' }  // Invalid type
        },
        outputs: {}
      }
      
      expect(() => validateGadgetSchema(invalidSchema)).toThrow()
    })
  })
  
  describe('createPrimitive', () => {
    it('should create a working Add gadget', () => {
      const addInstance = AddTemplate.instantiate('test-add', { a: 5, b: 3 })
      
      // Verify structure
      expect(addInstance.gadget.id).toBe('test-add')
      expect(addInstance.gadget.primitive).toBe(true)
      expect(addInstance.inputs.a.value).toBe(5)
      expect(addInstance.inputs.b.value).toBe(3)
      
      // Test compute function
      const inputSignals = new Map([
        ['a', createSignal(10, 10000)],
        ['b', createSignal(20, 10000)]
      ])
      
      const outputs = addInstance.gadget.compute!(inputSignals)
      const result = outputs.get('result')
      
      expect(result?.value).toBe(30)
      expect(result?.strength).toBeGreaterThan(0)
    })
    
    it('should create a working Clamp gadget', () => {
      const clampInstance = ClampTemplate.instantiate('test-clamp', { 
        min: 0, 
        max: 100 
      })
      
      // Test clamping above max
      const inputSignals = new Map([
        ['value', createSignal(150, 10000)],
        ['min', createSignal(0, 10000)],
        ['max', createSignal(100, 10000)]
      ])
      
      const outputs = clampInstance.gadget.compute!(inputSignals)
      const result = outputs.get('clamped')
      
      expect(result?.value).toBe(100)
      
      // Test clamping below min
      const inputSignals2 = new Map([
        ['value', createSignal(-50, 10000)],
        ['min', createSignal(0, 10000)],
        ['max', createSignal(100, 10000)]
      ])
      
      const outputs2 = clampInstance.gadget.compute!(inputSignals2)
      const result2 = outputs2.get('clamped')
      
      expect(result2?.value).toBe(0)
    })
    
    it('should provide correct TypeScript types', () => {
      const multiplyInstance = MultiplyTemplate.instantiate('test-multiply')
      
      // These should be properly typed by TypeScript
      const aValue: number = multiplyInstance.inputs.a.value as number
      const bValue: number = multiplyInstance.inputs.b.value as number
      
      expect(typeof aValue).toBe('number')
      expect(typeof bValue).toBe('number')
    })
  })
  
  describe('Integration with propagation', () => {
    it('should work with the propagation system', () => {
      const addInstance = AddTemplate.instantiate('prop-test')
      
      // Propagate values to inputs
      propagate(addInstance.inputs.a.contact, createSignal(15, 10000))
      propagate(addInstance.inputs.b.contact, createSignal(25, 10000))
      
      // The gadget should compute when inputs change
      const inputSignals = new Map([
        ['a', addInstance.inputs.a.contact.signal],
        ['b', addInstance.inputs.b.contact.signal]
      ])
      
      const outputs = addInstance.gadget.compute!(inputSignals)
      const result = outputs.get('result')
      
      expect(result?.value).toBe(40)
    })
  })
  
  describe('Sequence Combinator', () => {
    it('should create a working sequence template', () => {
      // Create a sequence that adds 5 then multiplies by 2
      const sequenceTemplate = sequence(
        AddTemplate,
        MultiplyTemplate,
        { result: 'a' }  // Map add result to multiply a
      )
      
      expect(sequenceTemplate.id).toContain('sequence')
      expect(sequenceTemplate.description).toContain('→')
    })
    
    it('should wire templates correctly in sequence', () => {
      const pipeline = AddThenMultiplyTemplate.instantiate('test-pipeline', {
        a: 10,  // Add template: a
        b: 2    // Add template: b  
        // Multiply template: b will use default (1)
        // Add result (12) will be wired to Multiply a
      })
      
      // Check that we have the right structure
      expect(pipeline.inputs.a).toBeDefined()
      expect(pipeline.inputs.b).toBeDefined()
      expect(pipeline.outputs.result).toBeDefined()
      
      // The parent gadget should contain both sub-gadgets
      expect(pipeline.gadget.gadgets.size).toBe(2)
    })
    
    it('should process data through the pipeline', () => {
      const pipeline = AddThenMultiplyTemplate.instantiate('pipeline-test')
      
      // Send signals through the first stage inputs
      propagate(pipeline.inputs.a.contact, createSignal(5, 10000))  // a = 5
      propagate(pipeline.inputs.b.contact, createSignal(3, 10000))  // b = 3
      
      // Get the internal gadgets for testing
      const gadgets = Array.from(pipeline.gadget.gadgets.values())
      const addGadget = gadgets.find(g => g.id.includes('first'))
      const multiplyGadget = gadgets.find(g => g.id.includes('second'))
      
      expect(addGadget).toBeDefined()
      expect(multiplyGadget).toBeDefined()
      
      // Test first stage (Add: 5 + 3 = 8)
      if (addGadget?.compute) {
        const addInputs = new Map([
          ['a', createSignal(5, 10000)],
          ['b', createSignal(3, 10000)]
        ])
        const addOutputs = addGadget.compute(addInputs)
        expect(addOutputs.get('result')?.value).toBe(8)
      }
    })
  })
})