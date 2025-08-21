/**
 * Template system for building reusable gadget patterns
 * Provides type-safe schemas and combinator functions for gadget composition
 */

import { z } from 'zod'
import { createGadget, createContact, signal, wire, type Gadget, type Signal, type Value } from './types'

// ============================================================================
// Meta-Schema Definition
// ============================================================================

/**
 * Zod validator for the shape of all gadget schemas
 */
const GadgetSchemaValidator = z.object({
  inputs: z.record(z.object({
    type: z.union([
      z.literal('number'),
      z.literal('string'), 
      z.literal('boolean'),
      z.literal('Float32Array'),
      z.literal('array'),
      z.literal('object')
    ]),
    default: z.any().optional(),
    description: z.string().optional()
  })),
  outputs: z.record(z.object({
    type: z.union([
      z.literal('number'),
      z.literal('string'),
      z.literal('boolean'), 
      z.literal('Float32Array'),
      z.literal('array'),
      z.literal('object')
    ]),
    description: z.string().optional()
  }))
})

/**
 * Clean TypeScript type for gadget schemas (hides Zod complexity)
 */
export type GadgetSchema = z.infer<typeof GadgetSchemaValidator>

// ============================================================================
// Type Inference Utilities
// ============================================================================

/**
 * Extract input types from a gadget schema
 */
export type InferInputs<T extends GadgetSchema> = {
  [K in keyof T['inputs']]: T['inputs'][K]['type'] extends 'number' ? number :
    T['inputs'][K]['type'] extends 'string' ? string :
    T['inputs'][K]['type'] extends 'boolean' ? boolean :
    T['inputs'][K]['type'] extends 'Float32Array' ? Float32Array :
    T['inputs'][K]['type'] extends 'array' ? Array<any> :
    T['inputs'][K]['type'] extends 'object' ? Record<string, any> :
    any
}

/**
 * Extract output types from a gadget schema
 */
export type InferOutputs<T extends GadgetSchema> = {
  [K in keyof T['outputs']]: T['outputs'][K]['type'] extends 'number' ? number :
    T['outputs'][K]['type'] extends 'string' ? string :
    T['outputs'][K]['type'] extends 'boolean' ? boolean :
    T['outputs'][K]['type'] extends 'Float32Array' ? Float32Array :
    T['outputs'][K]['type'] extends 'array' ? Array<any> :
    T['outputs'][K]['type'] extends 'object' ? Record<string, any> :
    any
}

/**
 * Extract default values from schema inputs
 */
export type InferDefaults<T extends GadgetSchema> = {
  [K in keyof T['inputs']]: T['inputs'][K]['default']
}

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Validate a gadget schema at runtime
 */
export function validateGadgetSchema(schema: unknown): GadgetSchema {
  return GadgetSchemaValidator.parse(schema)
}

/**
 * Type guard to check if an object is a valid gadget schema
 */
export function isGadgetSchema(obj: unknown): obj is GadgetSchema {
  return GadgetSchemaValidator.safeParse(obj).success
}

// ============================================================================
// Template Interface
// ============================================================================

/**
 * A gadget template that can be instantiated with specific parameters
 */
export interface GadgetTemplate<T extends GadgetSchema = GadgetSchema> {
  readonly schema: T
  readonly id: string
  readonly description?: string
  
  // Create a gadget instance from this template
  instantiate(id: string, params?: Partial<InferDefaults<T>>): TemplateInstance<T>
}

/**
 * Instance of a gadget template with typed contacts
 */
export interface TemplateInstance<T extends GadgetSchema> {
  readonly gadget: Gadget
  readonly schema: T
  readonly inputs: TypedContacts<T['inputs']>
  readonly outputs: TypedContacts<T['outputs']>
}

/**
 * Typed contact map for schema-based contact access
 */
export type TypedContacts<ContactDefs> = {
  [K in keyof ContactDefs]: ContactDefs[K] extends { type: infer T } ? {
    contact: import('./types').Contact
    value: T extends 'number' ? number :
      T extends 'string' ? string :
      T extends 'boolean' ? boolean :
      T extends 'Float32Array' ? Float32Array :
      T extends 'array' ? Array<any> :
      T extends 'object' ? Record<string, any> :
      any
  } : never
}

// ============================================================================
// Placeholder for Implementation Functions (to be built next)
// ============================================================================

/**
 * Create a primitive gadget from a schema and compute function
 */
export function createPrimitive<T extends GadgetSchema>(
  schema: T,
  implementation: {
    compute: (inputs: InferInputs<T>) => Partial<InferOutputs<T>>
    description?: string
  }
): GadgetTemplate<T> {
  // Validate schema at runtime
  const validatedSchema = validateGadgetSchema(schema)
  
  return {
    schema: validatedSchema as T,
    id: `primitive-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description: implementation.description,
    
    instantiate(id: string, params?: Partial<InferDefaults<T>>): TemplateInstance<T> {
      // Create the gadget
      const gadget = createGadget(id)
      gadget.primitive = true
      
      // Create input contacts with defaults
      const inputs = {} as TypedContacts<T['inputs']>
      for (const [contactName, contactDef] of Object.entries(schema.inputs)) {
        const defaultValue = params?.[contactName as keyof typeof params] ?? contactDef.default ?? null
        const contact = createContact(contactName, gadget, signal(defaultValue, 0), 'input')
        gadget.contacts.set(contactName, contact)
        inputs[contactName as keyof T['inputs']] = {
          contact,
          value: defaultValue
        } as any
      }
      
      // Create output contacts
      const outputs = {} as TypedContacts<T['outputs']>
      for (const [contactName, contactDef] of Object.entries(schema.outputs)) {
        const contact = createContact(contactName, gadget, signal(null, 0), 'output')
        gadget.contacts.set(contactName, contact)
        outputs[contactName as keyof T['outputs']] = {
          contact,
          value: null
        } as any
      }
      
      // Set up compute function
      gadget.compute = (inputSignals) => {
        // Extract typed input values
        const typedInputs = {} as InferInputs<T>
        for (const [contactName] of Object.entries(schema.inputs)) {
          const signal = inputSignals.get(contactName)
          typedInputs[contactName as keyof InferInputs<T>] = signal?.value as any
        }
        
        // Call user's compute function
        const result = implementation.compute(typedInputs)
        
        // Convert result to signal map
        const outputSignals = new Map<string, Signal>()
        for (const [outputName, outputValue] of Object.entries(result)) {
          if (outputValue !== undefined) {
            // Use average strength from inputs for output
            const inputStrengths = Array.from(inputSignals.values()).map(s => s.strength)
            const avgStrength = inputStrengths.length > 0 
              ? Math.floor(inputStrengths.reduce((sum, s) => sum + s, 0) / inputStrengths.length)
              : 10000
            
            outputSignals.set(outputName, signal(outputValue, avgStrength / 10000))
          }
        }
        
        return outputSignals
      }
      
      return {
        gadget,
        schema: validatedSchema as T,
        inputs,
        outputs
      }
    }
  }
}

/**
 * Compose templates in sequence (output of first becomes input of second)
 * Creates a new template that wires the output of template1 to the input of template2
 */
export function sequence<T1 extends GadgetSchema, T2 extends GadgetSchema>(
  template1: GadgetTemplate<T1>,
  template2: GadgetTemplate<T2>,
  mapping?: { [outputKey in keyof T1['outputs']]?: keyof T2['inputs'] }
): GadgetTemplate<{
  inputs: T1['inputs']
  outputs: T2['outputs']
}> {
  // Create a schema that combines the inputs of the first and outputs of the second
  const sequenceSchema = {
    inputs: template1.schema.inputs,
    outputs: template2.schema.outputs
  }
  
  return {
    schema: sequenceSchema,
    id: `sequence-${template1.id}-${template2.id}`,
    description: `Sequence: ${template1.description || template1.id} → ${template2.description || template2.id}`,
    
    instantiate(id: string, params?: any): TemplateInstance<any> {
      // Create instances of both templates
      const instance1 = template1.instantiate(`${id}-first`, params)
      const instance2 = template2.instantiate(`${id}-second`)
      
      // Create the parent gadget that contains both
      const parentGadget = createGadget(id)
      parentGadget.gadgets.set(instance1.gadget.id, instance1.gadget)
      parentGadget.gadgets.set(instance2.gadget.id, instance2.gadget)
      
      // Create boundary contacts for the parent gadget
      const inputs = {} as any
      const outputs = {} as any
      
      // Expose first template's inputs as parent inputs
      for (const [inputName, inputDef] of Object.entries(template1.schema.inputs)) {
        const boundaryContact = createContact(inputName, parentGadget, instance1.inputs[inputName].contact.signal, 'input', true)
        parentGadget.contacts.set(inputName, boundaryContact)
        
        // Wire boundary contact to first template's input
        wire(boundaryContact, instance1.inputs[inputName].contact)
        
        inputs[inputName] = {
          contact: boundaryContact,
          value: boundaryContact.signal.value
        }
      }
      
      // Expose second template's outputs as parent outputs  
      for (const [outputName, outputDef] of Object.entries(template2.schema.outputs)) {
        const boundaryContact = createContact(outputName, parentGadget, instance2.outputs[outputName].contact.signal, 'output', true)
        parentGadget.contacts.set(outputName, boundaryContact)
        
        // Wire second template's output to boundary contact
        wire(instance2.outputs[outputName].contact, boundaryContact)
        
        outputs[outputName] = {
          contact: boundaryContact,
          value: boundaryContact.signal.value
        }
      }
      
      // Wire first template's outputs to second template's inputs
      // Use explicit mapping if provided, otherwise try to auto-match by name
      if (mapping) {
        for (const [outputKey, inputKey] of Object.entries(mapping)) {
          if (outputKey && inputKey && 
              instance1.outputs[outputKey] && 
              instance2.inputs[inputKey]) {
            wire(instance1.outputs[outputKey].contact, instance2.inputs[inputKey].contact)
          }
        }
      } else {
        // Auto-wire matching names
        for (const outputName of Object.keys(template1.schema.outputs)) {
          if (template2.schema.inputs[outputName]) {
            wire(instance1.outputs[outputName].contact, instance2.inputs[outputName].contact)
          }
        }
      }
      
      return {
        gadget: parentGadget,
        schema: sequenceSchema,
        inputs,
        outputs
      }
    }
  }
}

/**
 * Run templates in parallel with shared inputs
 * TODO: Implement with type merging
 */
export function parallel<T extends GadgetSchema[]>(
  ...templates: { [K in keyof T]: GadgetTemplate<T[K]> }
): GadgetTemplate<any> {
  // TODO: Implement  
  throw new Error('parallel not implemented yet')
}

/**
 * Tap into data flow for side effects without modifying the stream
 * TODO: Implement
 */
export function tap<T extends GadgetSchema>(
  template: GadgetTemplate<T>,
  sideEffect: GadgetTemplate<any>
): GadgetTemplate<T> {
  // TODO: Implement
  throw new Error('tap not implemented yet')
}