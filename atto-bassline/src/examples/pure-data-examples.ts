/**
 * Examples demonstrating the pure data template approach
 * Templates are just data structures - no magic!
 */

import { 
  instantiate, 
  sequence, 
  parallel,
  primitive,
  type Template 
} from '../templates-v2'

// ============================================================================
// Basic Primitive Templates (Pure Data)
// ============================================================================

export const Scale = primitive(
  {
    inputs: {
      value: { type: 'number', default: 0 },
      min: { type: 'number', default: 0 },
      max: { type: 'number', default: 100 }
    },
    outputs: {
      scaled: { type: 'number' }
    }
  },
  ({ value, min, max }) => ({
    scaled: min + value * (max - min)
  }),
  'Scale value from 0-1 to min-max range'
)

export const Quantize = primitive(
  {
    inputs: {
      value: { type: 'number', default: 0 },
      step: { type: 'number', default: 1 }
    },
    outputs: {
      quantized: { type: 'number' }
    }
  },
  ({ value, step }) => ({
    quantized: Math.round(value / step) * step
  }),
  'Quantize to nearest step'
)

// ============================================================================
// Composite Templates (Just Data!)
// ============================================================================

/**
 * A slider processing pipeline defined as pure data
 * No functions, no classes, just structure
 */
export const SliderPipeline: Template = {
  components: [
    { id: 'scale', template: Scale },
    { id: 'quantize', template: Quantize }
  ],
  connections: [
    { from: 'scale.scaled', to: 'quantize.value' }
  ],
  expose: {
    inputs: {
      value: 'scale.value',
      min: 'scale.min',
      max: 'scale.max',
      step: 'quantize.step'
    },
    outputs: {
      result: 'quantize.quantized'
    }
  },
  description: 'Scale and quantize slider input'
}

/**
 * Audio envelope using explicit structure
 */
export const EnvelopeTemplate: Template = {
  components: [
    {
      id: 'attack',
      template: primitive(
        {
          inputs: { time: { type: 'number' }, duration: { type: 'number', default: 0.1 } },
          outputs: { level: { type: 'number' } }
        },
        ({ time, duration }) => ({
          level: Math.min(1, time / duration)
        }),
        'Attack phase'
      )
    },
    {
      id: 'sustain',
      template: primitive(
        {
          inputs: { level: { type: 'number' }, sustain: { type: 'number', default: 0.7 } },
          outputs: { output: { type: 'number' } }
        },
        ({ level, sustain }) => ({
          output: level * sustain
        }),
        'Apply sustain level'
      )
    }
  ],
  connections: [
    { from: 'attack.level', to: 'sustain.level' }
  ],
  expose: {
    inputs: {
      time: 'attack.time',
      attackTime: 'attack.duration',
      sustainLevel: 'sustain.sustain'
    },
    outputs: {
      amplitude: 'sustain.output'
    }
  }
}

// ============================================================================
// Using Combinators with Pure Data
// ============================================================================

/**
 * Create a multi-stage pipeline using the sequence combinator
 */
export const MultiStage = sequence([
  { template: Scale, from: 'scaled', to: 'value' },
  { template: Quantize, from: 'quantized', to: 'value' },
  { 
    template: primitive(
      {
        inputs: { value: { type: 'number' } },
        outputs: { clamped: { type: 'number' } }
      },
      ({ value }) => ({ clamped: Math.max(0, Math.min(100, value)) }),
      'Simple clamp'
    ),
    from: 'clamped'
  }
])

// ============================================================================
// Complex Nested Template
// ============================================================================

/**
 * A complex template showing deep nesting
 * Still just data - completely inspectable!
 */
export const ComplexProcessor: Template = {
  components: [
    { id: 'input', template: SliderPipeline },
    { id: 'envelope', template: EnvelopeTemplate },
    { 
      id: 'combiner',
      template: primitive(
        {
          inputs: { 
            signal: { type: 'number' },
            envelope: { type: 'number' }
          },
          outputs: {
            modulated: { type: 'number' }
          }
        },
        ({ signal, envelope }) => ({
          modulated: signal * envelope
        }),
        'Apply envelope to signal'
      )
    }
  ],
  connections: [
    { from: 'input.result', to: 'combiner.signal' },
    { from: 'envelope.amplitude', to: 'combiner.envelope' }
  ],
  expose: {
    inputs: {
      // From slider
      value: 'input.value',
      min: 'input.min',
      max: 'input.max',
      step: 'input.step',
      // From envelope
      time: 'envelope.time',
      attack: 'envelope.attackTime',
      sustain: 'envelope.sustainLevel'
    },
    outputs: {
      output: 'combiner.modulated'
    }
  },
  description: 'Complex signal processor with envelope'
}

// ============================================================================
// Benefits of Pure Data Templates
// ============================================================================

/**
 * 1. SERIALIZABLE - Can save/load templates as JSON
 */
export function serializeTemplate(template: Template): string {
  // Would need to handle function references for primitives
  // But the structure is pure JSON
  return JSON.stringify({
    ...template,
    components: template.components?.map(c => ({
      ...c,
      template: '<template-ref>' // In reality, use template IDs
    }))
  }, null, 2)
}

/**
 * 2. INSPECTABLE - Can analyze template structure
 */
export function analyzeTemplate(template: Template): {
  componentCount: number
  connectionCount: number
  inputCount: number
  outputCount: number
  depth: number
} {
  const componentCount = template.components?.length || 0
  const connectionCount = template.connections?.length || 0
  const inputCount = Object.keys(template.expose?.inputs || {}).length
  const outputCount = Object.keys(template.expose?.outputs || {}).length
  
  // Calculate depth by recursively checking components
  const depth = template.components ? 1 + Math.max(
    ...template.components.map(c => 
      analyzeTemplate(c.template).depth
    )
  ) : 0
  
  return { componentCount, connectionCount, inputCount, outputCount, depth }
}

/**
 * 3. TRANSFORMABLE - Can modify templates programmatically
 */
export function addDebugOutput(template: Template, debugOutput: string): Template {
  return {
    ...template,
    components: [
      ...(template.components || []),
      {
        id: 'debug',
        template: primitive(
          {
            inputs: { value: { type: 'any' } },
            outputs: { logged: { type: 'any' } }
          },
          ({ value }) => {
            console.log(`[DEBUG ${debugOutput}]:`, value)
            return { logged: value }
          },
          'Debug logger'
        )
      }
    ],
    connections: [
      ...(template.connections || []),
      // Wire the debug output
      { from: debugOutput, to: 'debug.value' }
    ]
  }
}

/**
 * 4. TESTABLE - Can verify template structure
 */
export function validateTemplate(template: Template): string[] {
  const errors: string[] = []
  
  // Check all connections reference valid components
  if (template.connections) {
    for (const conn of template.connections) {
      const [fromId] = conn.from.split('.')
      const [toId] = conn.to.split('.')
      
      const fromExists = template.components?.some(c => c.id === fromId)
      const toExists = template.components?.some(c => c.id === toId)
      
      if (!fromExists) errors.push(`Invalid from: ${conn.from}`)
      if (!toExists) errors.push(`Invalid to: ${conn.to}`)
    }
  }
  
  // Check exposed paths are valid
  // ... more validation ...
  
  return errors
}

// ============================================================================
// Usage Example
// ============================================================================

export function demonstratePureData() {
  // Templates are just data
  console.log('SliderPipeline structure:', analyzeTemplate(SliderPipeline))
  console.log('ComplexProcessor depth:', analyzeTemplate(ComplexProcessor).depth)
  
  // Can be serialized
  const json = serializeTemplate(SliderPipeline)
  console.log('Serialized:', json.substring(0, 200) + '...')
  
  // Can be validated
  const errors = validateTemplate(ComplexProcessor)
  console.log('Validation:', errors.length === 0 ? 'Valid!' : errors)
  
  // Instantiate when ready to use
  const gadget = instantiate(SliderPipeline, 'my-slider')
  console.log('Instantiated gadget:', gadget.id, 'with', gadget.contacts.size, 'contacts')
  
  return gadget
}