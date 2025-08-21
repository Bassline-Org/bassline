/**
 * Pure data template system for Atto-Bassline
 * Templates are just data structures describing gadget composition
 */

import { createGadget, createContact, signal, wire, type Gadget, type Signal, type Value } from './types'

// ============================================================================
// Core Template Types (Pure Data)
// ============================================================================

/**
 * A template is just data describing how to compose gadgets
 */
export interface Template {
  // Sub-templates to instantiate
  components?: Array<{
    id: string
    template: Template
  }>
  
  // How to wire components together
  connections?: Array<{
    from: string  // componentId.outputName
    to: string    // componentId.inputName
  }>
  
  // What contacts to expose as boundaries
  expose?: {
    inputs?: Record<string, string>   // externalName: internalPath
    outputs?: Record<string, string>  // externalName: internalPath
  }
  
  // For primitive templates: the compute function
  primitive?: {
    compute: (inputs: Record<string, any>) => Record<string, any>
  }
  
  // Metadata
  description?: string
}

/**
 * A primitive template that performs computation
 */
export interface PrimitiveTemplate extends Template {
  primitive: {
    compute: (inputs: Record<string, any>) => Record<string, any>
  }
  // Primitives have contacts but no components
  contacts: {
    inputs: Record<string, { type: string, default?: any }>
    outputs: Record<string, { type: string }>
  }
}

// ============================================================================
// Template Instantiation
// ============================================================================

/**
 * Turn a template (data) into a gadget (runtime object)
 */
export function instantiate(template: Template, id: string): Gadget {
  const gadget = createGadget(id)
  
  // Handle primitive templates
  if (template.primitive) {
    const prim = template as PrimitiveTemplate
    
    // Create input contacts
    for (const [name, def] of Object.entries(prim.contacts.inputs || {})) {
      const contact = createContact(name, gadget, signal(def.default ?? null, 0), 'input')
      gadget.contacts.set(name, contact)
    }
    
    // Create output contacts
    for (const [name, def] of Object.entries(prim.contacts.outputs || {})) {
      const contact = createContact(name, gadget, signal(null, 0), 'output')
      gadget.contacts.set(name, contact)
    }
    
    // Set compute function
    gadget.compute = (inputSignals) => {
      const inputs: Record<string, any> = {}
      for (const [name] of Object.entries(prim.contacts.inputs || {})) {
        inputs[name] = inputSignals.get(name)?.value
      }
      
      const outputs = prim.primitive.compute(inputs)
      
      const outputSignals = new Map<string, Signal>()
      for (const [name, value] of Object.entries(outputs)) {
        if (value !== undefined) {
          // Average input strengths for output
          const strengths = Array.from(inputSignals.values()).map(s => s.strength)
          const avgStrength = strengths.length > 0
            ? Math.floor(strengths.reduce((a, b) => a + b, 0) / strengths.length)
            : 10000
          outputSignals.set(name, { value, strength: avgStrength })
        }
      }
      
      return outputSignals
    }
    
    gadget.primitive = true
    return gadget
  }
  
  // Handle composite templates
  if (template.components) {
    // Instantiate all components
    const instances = new Map<string, Gadget>()
    for (const comp of template.components) {
      const instance = instantiate(comp.template, `${id}-${comp.id}`)
      instances.set(comp.id, instance)
      gadget.gadgets.set(instance.id, instance)
    }
    
    // Wire connections
    if (template.connections) {
      for (const conn of template.connections) {
        const [fromId, fromContact] = conn.from.split('.')
        const [toId, toContact] = conn.to.split('.')
        
        const fromGadget = instances.get(fromId)
        const toGadget = instances.get(toId)
        
        if (fromGadget && toGadget) {
          const from = fromGadget.contacts.get(fromContact)
          const to = toGadget.contacts.get(toContact)
          
          if (from && to) {
            wire(from, to)
          }
        }
      }
    }
    
    // Expose boundaries
    if (template.expose) {
      // Expose inputs
      if (template.expose.inputs) {
        for (const [external, internal] of Object.entries(template.expose.inputs)) {
          const [gadgetId, contactName] = internal.split('.')
          const targetGadget = instances.get(gadgetId)
          
          if (targetGadget) {
            const targetContact = targetGadget.contacts.get(contactName)
            if (targetContact) {
              // Create boundary contact
              const boundary = createContact(external, gadget, targetContact.signal, 'input', true)
              gadget.contacts.set(external, boundary)
              
              // Wire boundary to internal contact
              wire(boundary, targetContact)
            }
          }
        }
      }
      
      // Expose outputs
      if (template.expose.outputs) {
        for (const [external, internal] of Object.entries(template.expose.outputs)) {
          const [gadgetId, contactName] = internal.split('.')
          const sourceGadget = instances.get(gadgetId)
          
          if (sourceGadget) {
            const sourceContact = sourceGadget.contacts.get(contactName)
            if (sourceContact) {
              // Create boundary contact
              const boundary = createContact(external, gadget, sourceContact.signal, 'output', true)
              gadget.contacts.set(external, boundary)
              
              // Wire internal contact to boundary
              wire(sourceContact, boundary)
            }
          }
        }
      }
    }
  }
  
  return gadget
}

// ============================================================================
// Combinator Functions (Pure Functions on Data)
// ============================================================================

/**
 * Sequence templates in a pipeline
 * Each stage specifies which output connects to which input of the next stage
 */
export function sequence(stages: Array<{
  template: Template
  from?: string  // Output name from this template
  to?: string    // Input name to next template
}>): Template {
  const components = stages.map((stage, i) => ({
    id: `stage${i}`,
    template: stage.template
  }))
  
  const connections: Array<{ from: string, to: string }> = []
  
  // Wire each stage to the next
  for (let i = 0; i < stages.length - 1; i++) {
    const current = stages[i]
    const next = stages[i + 1]
    
    if (current.from) {
      // If next stage doesn't specify 'to', we still create the connection
      // The user should specify both, but for testing we'll use 'input' as default
      const toContact = next.to || 'input'
      connections.push({
        from: `stage${i}.${current.from}`,
        to: `stage${i + 1}.${toContact}`
      })
    }
  }
  
  // Expose first stage inputs and last stage outputs
  // For now, expose all of them - could be made configurable
  const expose: Template['expose'] = {
    inputs: {},
    outputs: {}
  }
  
  // This is simplified - in reality we'd need to introspect the templates
  // to know what inputs/outputs they have
  
  return {
    components,
    connections,
    expose,
    description: `Sequence of ${stages.length} stages`
  }
}

/**
 * Run templates in parallel with shared inputs
 */
export function parallel(templates: Template[]): Template {
  const components = templates.map((t, i) => ({
    id: `parallel${i}`,
    template: t
  }))
  
  // No connections - parallel templates don't connect to each other
  
  // Expose all inputs and outputs
  // In reality, we'd merge common inputs and combine all outputs
  const expose: Template['expose'] = {
    inputs: {},
    outputs: {}
  }
  
  return {
    components,
    connections: [],
    expose,
    description: `${templates.length} templates in parallel`
  }
}

/**
 * Tap a template for side effects without affecting the main flow
 */
export function tap(main: Template, side: Template): Template {
  return {
    components: [
      { id: 'main', template: main },
      { id: 'side', template: side }
    ],
    connections: [
      // Connect main outputs to side inputs for observation
      // But main flow continues unchanged
    ],
    expose: {
      inputs: {}, // Expose main inputs
      outputs: {} // Expose main outputs (not side)
    },
    description: `Tap for side effects`
  }
}

// ============================================================================
// Primitive Template Helpers
// ============================================================================

/**
 * Create a primitive template from a compute function
 */
export function primitive(
  contacts: {
    inputs: Record<string, { type: string, default?: any }>
    outputs: Record<string, { type: string }>
  },
  compute: (inputs: Record<string, any>) => Record<string, any>,
  description?: string
): PrimitiveTemplate {
  return {
    primitive: { compute },
    contacts,
    description
  }
}

// ============================================================================
// Example Primitive Templates (Pure Data)
// ============================================================================

export const Add = primitive(
  {
    inputs: {
      a: { type: 'number', default: 0 },
      b: { type: 'number', default: 0 }
    },
    outputs: {
      result: { type: 'number' }
    }
  },
  ({ a, b }) => ({ result: a + b }),
  'Add two numbers'
)

export const Multiply = primitive(
  {
    inputs: {
      a: { type: 'number', default: 1 },
      b: { type: 'number', default: 1 }
    },
    outputs: {
      result: { type: 'number' }
    }
  },
  ({ a, b }) => ({ result: a * b }),
  'Multiply two numbers'
)

export const Clamp = primitive(
  {
    inputs: {
      value: { type: 'number', default: 0 },
      min: { type: 'number', default: 0 },
      max: { type: 'number', default: 100 }
    },
    outputs: {
      clamped: { type: 'number' }
    }
  },
  ({ value, min, max }) => ({
    clamped: Math.max(min, Math.min(max, value))
  }),
  'Clamp value between min and max'
)

// UI Templates for convenience (also defined in ui-templates.ts)
export const SliderTemplate = primitive(
  {
    inputs: {
      value: { type: 'number', default: 50 },
      min: { type: 'number', default: 0 },
      max: { type: 'number', default: 100 },
      step: { type: 'number', default: 1 },
      enabled: { type: 'boolean', default: true }
    },
    outputs: {
      isDragging: { type: 'boolean' },
      normalizedValue: { type: 'number' }
    }
  },
  ({ value, min, max }) => ({
    normalizedValue: (value - min) / (max - min)
  }),
  'Slider UI component'
)

export const TextFieldTemplate = primitive(
  {
    inputs: {
      text: { type: 'string', default: '' },
      placeholder: { type: 'string', default: 'Enter text...' },
      maxLength: { type: 'number', default: 100 },
      enabled: { type: 'boolean', default: true },
      validation: { type: 'string', default: '.*' }
    },
    outputs: {
      isFocused: { type: 'boolean' },
      isValid: { type: 'boolean' },
      length: { type: 'number' }
    }
  },
  ({ text, validation }) => {
    const regex = new RegExp(validation)
    return {
      isValid: regex.test(text),
      length: text.length
    }
  },
  'Text field UI component'
)