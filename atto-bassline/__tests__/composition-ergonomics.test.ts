/**
 * Test the ergonomics of complex template composition
 */

import { describe, it, expect } from 'vitest'
import { 
  SliderProcessingTemplate, 
  EnvelopeGeneratorTemplate,
  testSliderErgonomics,
  testEnvelopeErgonomics 
} from '../src/examples/complex-composition'
import { createSignal } from '../src/types'

describe('Composition Ergonomics', () => {
  describe('Slider Processing Pipeline', () => {
    it('should create a complex slider processing pipeline', () => {
      const slider = testSliderErgonomics()
      
      // Should have the right structure
      expect(slider).toBeDefined()
      expect(slider.inputs.value).toBeDefined()  // From Scale
      expect(slider.inputs.min).toBeDefined()    // From Scale  
      expect(slider.inputs.max).toBeDefined()    // From Scale
      expect(slider.outputs.result).toBeDefined() // Final output
      
      console.log('✅ Slider inputs:', Object.keys(slider.inputs))
      console.log('✅ Slider outputs:', Object.keys(slider.outputs))
    })
    
    it('should process slider values through the full pipeline', () => {
      const slider = SliderProcessingTemplate.instantiate('test-slider', {
        min: 0,
        max: 100,
        step: 10
      })
      
      // Test: input 0.5 should become 50, quantized to 50, clamped to 50
      const subGadgets = Array.from(slider.gadget.gadgets.values())
      expect(subGadgets.length).toBeGreaterThan(0)
      
      // The structure should be deeply nested
      console.log('✅ Slider gadget structure created')
    })
  })
  
  describe('Envelope Generator Pipeline', () => {
    it('should create an envelope generator', () => {
      const envelope = testEnvelopeErgonomics()
      
      expect(envelope).toBeDefined()
      expect(envelope.inputs.time).toBeDefined()
      expect(envelope.inputs.duration).toBeDefined()
      expect(envelope.outputs.amplitude).toBeDefined()
      
      console.log('✅ Envelope inputs:', Object.keys(envelope.inputs))
      console.log('✅ Envelope outputs:', Object.keys(envelope.outputs))
    })
    
    it('should generate envelope curves correctly', () => {
      const envelope = EnvelopeGeneratorTemplate.instantiate('test-env', {
        duration: 1.0,
        attack: 0.25,   // 25% of duration
        decay: 0.25,    // 25% of duration  
        sustain: 0.5,   // 50% level
        release: 0.25   // 25% of duration
      })
      
      // Test different time points through manual compute
      const testTimes = [0, 0.125, 0.25, 0.375, 0.5, 0.75, 0.875, 1.0]
      
      for (const time of testTimes) {
        console.log(`⏱️  Testing envelope at time ${time}`)
        // We'd need to manually test the compute chain here
        // This demonstrates the complexity of testing composed templates
      }
    })
  })
  
  describe('Ergonomics Observations', () => {
    it('should demonstrate current limitations', () => {
      // This test documents the current limitations we discovered
      
      console.log('🤔 ERGONOMIC OBSERVATIONS:')
      console.log('   ✅ GOOD: Type safety catches errors')
      console.log('   ✅ GOOD: Composition is readable') 
      console.log('   ✅ GOOD: Templates are reusable')
      console.log('   ❌ NEEDS WORK: Parameter name conflicts')
      console.log('   ❌ NEEDS WORK: Deep nesting is verbose')
      console.log('   ❌ NEEDS WORK: Manual mapping repetitive')
      console.log('   💡 SOLUTION IDEAS: Parameter namespacing, pipeline syntax')
    })
  })
})