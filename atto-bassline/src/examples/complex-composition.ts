/**
 * Complex composition example demonstrating template ergonomics
 * This tests how it feels to build real gadgets using the template system
 */

import { createPrimitive, sequence, type GadgetSchema } from '../templates'
import { AddTemplate, MultiplyTemplate, ClampTemplate, QuantizeTemplate } from './math-gadgets'

// ============================================================================
// Real-World Example: Slider Input Processing
// ============================================================================

/**
 * A typical UI slider needs:
 * 1. Raw input value (0-1 from drag)
 * 2. Scale to range (min-max)  
 * 3. Quantize to steps
 * 4. Clamp to bounds (safety)
 */

// First, let's create a Scale template for range mapping
const ScaleSchema = {
  inputs: {
    value: { type: 'number', default: 0, description: 'Input value (typically 0-1)' },
    min: { type: 'number', default: 0, description: 'Output minimum' },
    max: { type: 'number', default: 100, description: 'Output maximum' }
  },
  outputs: {
    scaled: { type: 'number', description: 'Scaled value' }
  }
} satisfies GadgetSchema

const ScaleTemplate = createPrimitive(ScaleSchema, {
  description: 'Scale a value from 0-1 to min-max range',
  compute: ({ value, min, max }) => ({
    scaled: min + value * (max - min)
  })
})

// Now compose the full slider processing pipeline
export const SliderProcessingTemplate = sequence(
  sequence(
    sequence(
      ScaleTemplate,           // 0-1 → min-max range
      QuantizeTemplate,        // → discrete steps
      { scaled: 'value' }      // Map scaled → value
    ),
    ClampTemplate,             // → safety bounds
    { quantized: 'value' }     // Map quantized → value
  ),
  // Final identity just to test three-level nesting
  createPrimitive({
    inputs: { final: { type: 'number' } },
    outputs: { result: { type: 'number' } }
  }, {
    compute: ({ final }) => ({ result: final })
  }),
  { clamped: 'final' }
)

// ============================================================================
// Example: Audio Envelope Generator
// ============================================================================

/**
 * Audio envelope that transforms time → amplitude curve
 * Demonstrates domain-specific gadget composition
 */

const TimeToPhaseSchema = {
  inputs: {
    time: { type: 'number', default: 0, description: 'Time in seconds' },
    duration: { type: 'number', default: 1, description: 'Total duration' }
  },
  outputs: {
    phase: { type: 'number', description: 'Phase 0-1' }
  }
} satisfies GadgetSchema

const TimeToPhaseTemplate = createPrimitive(TimeToPhaseSchema, {
  description: 'Convert time to phase (0-1)',
  compute: ({ time, duration }) => ({
    phase: Math.max(0, Math.min(1, time / duration))
  })
})

const ADSREnvelopeSchema = {
  inputs: {
    phase: { type: 'number', default: 0, description: 'Phase 0-1' },
    attack: { type: 'number', default: 0.1, description: 'Attack time ratio' },
    decay: { type: 'number', default: 0.2, description: 'Decay time ratio' },
    sustain: { type: 'number', default: 0.7, description: 'Sustain level' },
    release: { type: 'number', default: 0.3, description: 'Release time ratio' }
  },
  outputs: {
    amplitude: { type: 'number', description: 'Envelope amplitude' }
  }
} satisfies GadgetSchema

const ADSREnvelopeTemplate = createPrimitive(ADSREnvelopeSchema, {
  description: 'ADSR envelope generator',
  compute: ({ phase, attack, decay, sustain, release }) => {
    const attackEnd = attack
    const decayEnd = attack + decay
    const releaseStart = 1 - release
    
    let amplitude = 0
    
    if (phase <= attackEnd) {
      // Attack phase: 0 → 1
      amplitude = phase / attack
    } else if (phase <= decayEnd) {
      // Decay phase: 1 → sustain
      const decayPhase = (phase - attackEnd) / decay
      amplitude = 1 - decayPhase * (1 - sustain)
    } else if (phase <= releaseStart) {
      // Sustain phase
      amplitude = sustain
    } else {
      // Release phase: sustain → 0
      const releasePhase = (phase - releaseStart) / release
      amplitude = sustain * (1 - releasePhase)
    }
    
    return { amplitude: Math.max(0, Math.min(1, amplitude)) }
  }
})

// Compose time → envelope pipeline
export const EnvelopeGeneratorTemplate = sequence(
  TimeToPhaseTemplate,
  ADSREnvelopeTemplate,
  { phase: 'phase' }  // Wire phase through
)

// ============================================================================
// Usage and Ergonomics Testing
// ============================================================================

/**
 * Test how ergonomic it is to use these composed templates
 */
export function testSliderErgonomics() {
  // Create a slider that maps 0-1 input to 20-2000 Hz with 10Hz steps
  const frequencySlider = SliderProcessingTemplate.instantiate('freq-slider', {
    // Scale parameters
    min: 20,
    max: 2000,
    // Quantize parameters  
    step: 10,
    // Clamp parameters (safety - same as scale but could be different)
    // min: 20, max: 2000  // These would conflict, showing need for better param handling
  })
  
  console.log('Frequency slider inputs:', Object.keys(frequencySlider.inputs))
  console.log('Frequency slider outputs:', Object.keys(frequencySlider.outputs))
  
  return frequencySlider
}

export function testEnvelopeErgonomics() {
  // Create an envelope generator
  const envelope = EnvelopeGeneratorTemplate.instantiate('env-gen', {
    duration: 2.0,    // 2 second envelope
    attack: 0.1,      // 10% attack
    decay: 0.2,       // 20% decay  
    sustain: 0.7,     // 70% sustain level
    release: 0.3      // 30% release
  })
  
  console.log('Envelope inputs:', Object.keys(envelope.inputs))
  console.log('Envelope outputs:', Object.keys(envelope.outputs))
  
  return envelope
}

// ============================================================================
// Observations About Ergonomics
// ============================================================================

/**
 * Notes from building these examples:
 * 
 * GOOD:
 * - Type safety is excellent - TypeScript catches mapping errors
 * - Composition is clean and readable
 * - Each template is focused and reusable
 * - sequence() handles wiring automatically
 * 
 * NEEDS IMPROVEMENT:
 * - Parameter conflicts: multiple templates have 'min'/'max' but mean different things
 * - Deep nesting gets verbose: sequence(sequence(sequence(...)))
 * - No easy way to rename inputs/outputs in composition
 * - Manual mapping { scaled: 'value' } is repetitive
 * 
 * POSSIBLE SOLUTIONS:
 * - Parameter namespacing: { scale: { min: 20, max: 2000 }, clamp: { min: 0, max: 5000 } }
 * - Pipeline syntax: pipeline(Scale, Quantize, Clamp)
 * - Auto-mapping with rename: Scale.rename({ scaled: 'value' })
 * - Template inheritance/mixins
 */