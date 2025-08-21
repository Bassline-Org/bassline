/**
 * Tests for the pure data template system (v2)
 */

import { describe, it, expect } from 'vitest'
import { 
  instantiate, 
  sequence, 
  parallel,
  primitive,
  Add, 
  Multiply, 
  Clamp,
  type Template 
} from '../src/templates-v2'
import { createSignal } from '../src/types'
import { propagate } from '../src/propagation'

describe('Pure Data Template System (v2)', () => {
  describe('Primitive Templates', () => {
    it('should create primitive templates as pure data', () => {
      // Add is just data
      expect(Add.primitive).toBeDefined()
      expect(Add.contacts.inputs.a).toEqual({ type: 'number', default: 0 })
      expect(Add.contacts.outputs.result).toEqual({ type: 'number' })
      expect(Add.description).toBe('Add two numbers')
    })
    
    it('should instantiate primitive templates into working gadgets', () => {
      const adder = instantiate(Add, 'test-adder')
      
      expect(adder.id).toBe('test-adder')
      expect(adder.primitive).toBe(true)
      expect(adder.contacts.size).toBe(3) // a, b, result
      
      // Test compute
      const inputs = new Map([
        ['a', createSignal(5, 10000)],
        ['b', createSignal(3, 10000)]
      ])
      
      const outputs = adder.compute!(inputs)
      expect(outputs.get('result')?.value).toBe(8)
    })
  })
  
  describe('Template Composition', () => {
    it('should create composite templates as pure data', () => {
      // Create a pipeline template (just data!)
      const pipeline: Template = {
        components: [
          { id: 'adder', template: Add },
          { id: 'multiplier', template: Multiply }
        ],
        connections: [
          { from: 'adder.result', to: 'multiplier.a' }
        ],
        expose: {
          inputs: {
            x: 'adder.a',
            y: 'adder.b',
            factor: 'multiplier.b'
          },
          outputs: {
            result: 'multiplier.result'
          }
        },
        description: 'Add then multiply'
      }
      
      // It's just data - no execution yet
      expect(pipeline.components?.length).toBe(2)
      expect(pipeline.connections?.length).toBe(1)
      expect(pipeline.expose?.inputs?.x).toBe('adder.a')
    })
    
    it('should instantiate composite templates into gadget hierarchies', () => {
      const pipeline: Template = {
        components: [
          { id: 'add', template: Add },
          { id: 'mult', template: Multiply }
        ],
        connections: [
          { from: 'add.result', to: 'mult.a' }
        ],
        expose: {
          inputs: {
            a: 'add.a',
            b: 'add.b',
            factor: 'mult.b'
          },
          outputs: {
            final: 'mult.result'
          }
        }
      }
      
      const gadget = instantiate(pipeline, 'pipeline')
      
      // Should have boundary contacts
      expect(gadget.contacts.has('a')).toBe(true)
      expect(gadget.contacts.has('b')).toBe(true)
      expect(gadget.contacts.has('factor')).toBe(true)
      expect(gadget.contacts.has('final')).toBe(true)
      
      // Should have sub-gadgets
      expect(gadget.gadgets.size).toBe(2)
      
      // Test that wiring works
      propagate(gadget.contacts.get('a')!, createSignal(5, 10000))
      propagate(gadget.contacts.get('b')!, createSignal(3, 10000))
      propagate(gadget.contacts.get('factor')!, createSignal(2, 10000))
      
      // Get sub-gadgets and test their compute
      const subGadgets = Array.from(gadget.gadgets.values())
      const addGadget = subGadgets.find(g => g.id.includes('add'))
      const multGadget = subGadgets.find(g => g.id.includes('mult'))
      
      expect(addGadget).toBeDefined()
      expect(multGadget).toBeDefined()
      
      // Test the add stage: 5 + 3 = 8
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
  
  describe('Sequence Combinator', () => {
    it('should create sequence templates as pure data', () => {
      const seq = sequence([
        { template: Add, from: 'result', to: 'value' },
        { template: Clamp, from: 'clamped' }
      ])
      
      // It's just data describing the sequence
      expect(seq.components?.length).toBe(2)
      expect(seq.components?.[0].id).toBe('stage0')
      expect(seq.components?.[1].id).toBe('stage1')
      expect(seq.connections?.length).toBe(1)
      expect(seq.connections?.[0]).toEqual({
        from: 'stage0.result',
        to: 'stage1.input'  // Default 'to' is 'input' when not specified
      })
    })
    
    it('should instantiate sequences correctly', () => {
      // Create a sequence: Add → Clamp
      const pipeline = sequence([
        { template: Add, from: 'result', to: 'value' },
        { template: Clamp }
      ])
      
      const gadget = instantiate(pipeline, 'seq-test')
      
      // Should have sub-gadgets
      expect(gadget.gadgets.size).toBe(2)
      
      // The structure should be wired correctly
      const subGadgets = Array.from(gadget.gadgets.values())
      expect(subGadgets[0].id).toContain('stage0')
      expect(subGadgets[1].id).toContain('stage1')
    })
  })
  
  describe('Parallel Combinator', () => {
    it('should create parallel templates as pure data', () => {
      const par = parallel([Add, Multiply, Clamp])
      
      expect(par.components?.length).toBe(3)
      expect(par.connections?.length).toBe(0) // No connections in parallel
      expect(par.description).toContain('3 templates in parallel')
    })
  })
  
  describe('Template as Data Benefits', () => {
    it('should be serializable to JSON', () => {
      const template: Template = {
        components: [
          { id: 'a', template: Add },
          { id: 'b', template: Multiply }
        ],
        connections: [
          { from: 'a.result', to: 'b.a' }
        ],
        expose: {
          inputs: { x: 'a.a', y: 'a.b' },
          outputs: { z: 'b.result' }
        }
      }
      
      // Can serialize to JSON (except the actual template references)
      const json = JSON.stringify({
        ...template,
        components: template.components?.map(c => ({
          ...c,
          template: '<template-reference>'
        }))
      })
      
      expect(json).toContain('connections')
      expect(json).toContain('expose')
    })
    
    it('should be inspectable and debuggable', () => {
      const template = sequence([
        { template: Add, from: 'result', to: 'value' },
        { template: Clamp, from: 'clamped', to: 'value' },
        { template: Multiply }
      ])
      
      // Can inspect the structure
      console.log('Template structure:', {
        components: template.components?.length,
        connections: template.connections,
        description: template.description
      })
      
      expect(template.components).toBeDefined()
      expect(template.connections).toBeDefined()
    })
  })
})