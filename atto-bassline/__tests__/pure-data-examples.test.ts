/**
 * Test the pure data examples
 */

import { describe, it, expect } from 'vitest'
import {
  SliderPipeline,
  ComplexProcessor,
  analyzeTemplate,
  validateTemplate,
  serializeTemplate,
  demonstratePureData
} from '../src/examples/pure-data-examples'
import { instantiate } from '../src/templates-v2'

describe('Pure Data Examples', () => {
  it('should analyze template structure', () => {
    const analysis = analyzeTemplate(SliderPipeline)
    
    expect(analysis.componentCount).toBe(2)
    expect(analysis.connectionCount).toBe(1)
    expect(analysis.inputCount).toBe(4)  // value, min, max, step
    expect(analysis.outputCount).toBe(1)  // result
    expect(analysis.depth).toBeGreaterThanOrEqual(1)
  })
  
  it('should handle complex nested templates', () => {
    const analysis = analyzeTemplate(ComplexProcessor)
    
    expect(analysis.componentCount).toBe(3)  // input, envelope, combiner
    expect(analysis.connectionCount).toBe(2)
    expect(analysis.inputCount).toBe(7)  // All exposed inputs
    expect(analysis.outputCount).toBe(1)
    expect(analysis.depth).toBeGreaterThanOrEqual(2)  // Nested templates
  })
  
  it('should serialize templates to JSON', () => {
    const json = serializeTemplate(SliderPipeline)
    const parsed = JSON.parse(json)
    
    expect(parsed.components).toBeDefined()
    expect(parsed.connections).toBeDefined()
    expect(parsed.expose).toBeDefined()
    expect(parsed.description).toBe('Scale and quantize slider input')
  })
  
  it('should validate template structure', () => {
    const errors = validateTemplate(SliderPipeline)
    expect(errors).toEqual([])  // Should be valid
    
    // Test invalid template
    const badTemplate = {
      components: [
        { id: 'a', template: SliderPipeline }
      ],
      connections: [
        { from: 'nonexistent.output', to: 'a.input' }  // Invalid reference
      ]
    }
    
    const badErrors = validateTemplate(badTemplate)
    expect(badErrors.length).toBeGreaterThan(0)
    expect(badErrors[0]).toContain('Invalid from')
  })
  
  it('should instantiate templates into working gadgets', () => {
    const gadget = instantiate(SliderPipeline, 'test-slider')
    
    expect(gadget.id).toBe('test-slider')
    expect(gadget.contacts.has('value')).toBe(true)
    expect(gadget.contacts.has('min')).toBe(true)
    expect(gadget.contacts.has('max')).toBe(true)
    expect(gadget.contacts.has('step')).toBe(true)
    expect(gadget.contacts.has('result')).toBe(true)
    
    // Should have sub-gadgets
    expect(gadget.gadgets.size).toBe(2)  // scale and quantize
  })
  
  it('should demonstrate all pure data benefits', () => {
    // Run the demonstration
    const gadget = demonstratePureData()
    
    expect(gadget).toBeDefined()
    expect(gadget.id).toBe('my-slider')
    
    // The console output shows the benefits:
    // - Serialization
    // - Analysis
    // - Validation
    // - Instantiation
  })
})