/**
 * Dynamic Gadgets - Universal template interpreters
 * 
 * Dynamic gadgets separate structure (eager) from behavior (late),
 * allowing runtime modification of network topology.
 */

import { Gadget, Contact, Signal, Value, createGadget, createContact, wire } from './types'
import { propagate } from './propagation'

// ============================================================================
// Types
// ============================================================================

/**
 * Specification for dynamic gadget structure and behavior
 */
export interface DynamicGadgetSpec {
  // Built immediately when gadget is created
  structure: {
    contacts?: {
      [name: string]: {
        direction: 'input' | 'output'
        boundary?: boolean
        initial?: { value: Value, strength: number }
      }
    }
    
    wires?: Array<{
      from: string  // Path like "child.output" or "input"
      to: string
    }>
    
    children?: {
      [id: string]: DynamicGadgetSpec | { ref: string }
    }
  }
  
  // Bound at runtime via propagation
  behavior?: BehaviorSpec
  
  // Special contacts for dynamic binding
  bindings?: {
    behavior?: string   // Contact name for behavior input
    validator?: string  // Contact for validator input
    library?: string    // Contact for library input
  }
  
  // Static metadata (doesn't affect computation)
  properties?: Record<string, any>
}

/**
 * Behavior specification as data
 */
export interface BehaviorSpec {
  // External dependencies
  requires?: {
    [name: string]: {
      type: 'template' | 'library' | 'value'
      description?: string
    }
  }
  
  // Computation description
  compute?: ComputeSpec
}

export type ComputeSpec = 
  | { type: 'primitive', name: string, params?: any }
  | { type: 'expression', expr: ExpressionSpec }
  | { type: 'conditional', condition: ExpressionSpec, then: ComputeSpec, else?: ComputeSpec }
  | { type: 'sequence', steps: ComputeSpec[] }
  | { type: 'propagate', from: string, to: string, transform?: ExpressionSpec }

export interface ExpressionSpec {
  op: string  // Operation name
  args?: Record<string, any>  // Arguments
}

/**
 * Template signal - flows through network as data
 */
export interface TemplateSignal {
  tag: 'template'
  value: {
    gadgetType?: string
    spec?: DynamicGadgetSpec
    params?: Record<string, any>
  }
}

/**
 * Instance signal - reference to spawned gadget
 */
export interface InstanceSignal {
  tag: 'instance'
  value: {
    id: string
    gadget: WeakRef<Gadget>
    born: number  // Timestamp
    generation: number
  }
}

// ============================================================================
// Dynamic Gadget Creation
// ============================================================================

/**
 * Creates a dynamic gadget with eager structure and late behavior
 */
export function createDynamicGadget(id: string, spec: DynamicGadgetSpec): Gadget {
  const gadget = createGadget(id)
  
  // Store spec for later use AFTER gadget is created
  Object.assign(gadget, {
    __spec: spec,
    __boundBehavior: null,
    __validator: null
  })
  
  // EAGER: Build structure immediately
  
  // Create regular contacts
  if (spec.structure.contacts) {
    for (const [name, contactSpec] of Object.entries(spec.structure.contacts)) {
      const contact = createContact(
        name,
        gadget,
        contactSpec.initial && {
          value: contactSpec.initial.value,
          strength: contactSpec.initial.strength
        },
        contactSpec.direction,
        contactSpec.boundary
      )
      gadget.contacts.set(name, contact)
    }
  }
  
  // Create binding contacts
  if (spec.bindings) {
    if (spec.bindings.behavior) {
      const behaviorContact = createContact(spec.bindings.behavior, gadget, undefined, 'input')
      gadget.contacts.set(spec.bindings.behavior, behaviorContact)
    }
    
    if (spec.bindings.validator) {
      const validatorContact = createContact(spec.bindings.validator, gadget, undefined, 'input')
      gadget.contacts.set(spec.bindings.validator, validatorContact)
    }
    
    if (spec.bindings.library) {
      const libraryContact = createContact(spec.bindings.library, gadget, undefined, 'input')
      gadget.contacts.set(spec.bindings.library, libraryContact)
    }
  }
  
  // Create child gadgets (also eager)
  if (spec.structure.children) {
    for (const [childId, childSpec] of Object.entries(spec.structure.children)) {
      if ('ref' in childSpec) {
        // Reference to external template - create placeholder
        const placeholder = createGadget(childId)
        placeholder.contacts.set('__awaiting_template', createContact('__awaiting_template', placeholder))
        gadget.gadgets.set(childId, placeholder)
      } else {
        // Direct specification - create child
        const child = createDynamicGadget(childId, childSpec as DynamicGadgetSpec)
        gadget.gadgets.set(childId, child)
        child.parent = new WeakRef(gadget)
      }
    }
  }
  
  // Wire internal connections (structure exists even without behavior!)
  if (spec.structure.wires) {
    for (const wireSpec of spec.structure.wires) {
      const fromContact = resolveContactPath(gadget, wireSpec.from)
      const toContact = resolveContactPath(gadget, wireSpec.to)
      
      if (fromContact && toContact) {
        wire(fromContact, toContact)
      }
    }
  }
  
  // Add properties as metadata
  if (spec.properties) {
    (gadget as any).properties = spec.properties
  }
  
  // LATE: Behavior bound via compute
  gadget.compute = (inputs: Map<string, Signal>) => {
    // Check for validator binding (store for persistence)
    if (spec.bindings?.validator) {
      const validatorSignal = inputs.get(spec.bindings.validator)
      if (validatorSignal?.value) {
        (gadget as any).__boundValidator = validatorSignal.value
      }
    }
    
    // Check for behavior binding
    if (spec.bindings?.behavior) {
      const behaviorSignal = inputs.get(spec.bindings.behavior)
      if (behaviorSignal?.value && behaviorSignal.value !== (gadget as any).__boundBehavior) {
        // New behavior arrived - validate and bind
        const valid = validateBehavior(gadget, behaviorSignal.value, inputs)
        if (valid) {
          (gadget as any).__boundBehavior = behaviorSignal.value
        } else {
          return new Map([
            ['__error', {
              value: { tag: 'contradiction', value: 'Invalid behavior' },
              strength: 10000
            }]
          ])
        }
      }
    }
    
    // Execute bound behavior if present
    const behavior = (gadget as any).__boundBehavior
    if (behavior) {
      return executeBehavior(behavior, inputs, gadget)
    }
    
    // No behavior - default propagation through structure
    return defaultPropagate(inputs, gadget)
  }
  
  return gadget
}

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Resolves a contact path like "child.output" or "input"
 */
function resolveContactPath(gadget: Gadget, path: string): Contact | null {
  const parts = path.split('.')
  
  if (parts.length === 1) {
    // Direct contact on this gadget
    return gadget.contacts.get(parts[0]) || null
  } else if (parts.length === 2) {
    // Contact on child gadget
    const child = gadget.gadgets.get(parts[0])
    if (child) {
      return child.contacts.get(parts[1]) || null
    }
  }
  
  return null
}

// ============================================================================
// Behavior Validation
// ============================================================================

/**
 * Validates a behavior against optional validator
 */
function validateBehavior(
  gadget: Gadget,
  behavior: BehaviorSpec,
  inputs: Map<string, Signal>
): boolean {
  const spec = (gadget as any).__spec as DynamicGadgetSpec
  
  // Check for validator (bound or in current inputs)
  let validator = (gadget as any).__boundValidator
  
  if (!validator && spec.bindings?.validator) {
    const validatorSignal = inputs.get(spec.bindings.validator)
    if (validatorSignal?.value) {
      validator = validatorSignal.value
    }
  }
  
  if (validator) {
    // Run validator
    return runValidator(behavior, validator)
  }
  
  // No validator - accept by default
  return true
}

/**
 * Runs a validator on a behavior
 */
function runValidator(behavior: BehaviorSpec, validator: any): boolean {
  // Simple validation for now
  if (validator.type === 'sandbox') {
    // Check for forbidden operations
    const forbidden = validator.deny || []
    const behaviorStr = JSON.stringify(behavior)
    
    for (const op of forbidden) {
      if (behaviorStr.includes(op)) {
        return false
      }
    }
  }
  
  return true
}

// ============================================================================
// Behavior Execution
// ============================================================================

/**
 * Executes a behavior specification
 */
function executeBehavior(
  behavior: BehaviorSpec,
  inputs: Map<string, Signal>,
  gadget: Gadget
): Map<string, Signal> {
  if (!behavior.compute) {
    return new Map()
  }
  
  return executeCompute(behavior.compute, inputs, gadget)
}

/**
 * Executes a compute specification
 */
function executeCompute(
  compute: ComputeSpec,
  inputs: Map<string, Signal>,
  gadget: Gadget
): Map<string, Signal> {
  switch (compute.type) {
    case 'primitive':
      // Delegate to primitive (would need registry)
      return executePrimitive(compute.name, compute.params, inputs)
      
    case 'expression':
      // Evaluate expression
      const exprResult = evaluateExpression(compute.expr, inputs, gadget)
      return new Map([['output', exprResult]])
      
    case 'conditional':
      // Conditional execution
      const condition = evaluateExpression(compute.condition, inputs, gadget)
      if (condition.value) {
        return executeCompute(compute.then, inputs, gadget)
      } else if (compute.else) {
        return executeCompute(compute.else, inputs, gadget)
      }
      return new Map()
      
    case 'sequence':
      // Execute steps in sequence
      let seqResult = new Map<string, Signal>()
      for (const step of compute.steps) {
        seqResult = executeCompute(step, inputs, gadget)
      }
      return seqResult
      
    case 'propagate':
      // Propagate with optional transform
      const fromSignal = inputs.get(compute.from)
      if (!fromSignal) return new Map()
      
      let signal = fromSignal
      if (compute.transform) {
        signal = evaluateExpression(compute.transform, inputs, gadget)
      }
      
      return new Map([[compute.to, signal]])
      
    default:
      return new Map()
  }
}

/**
 * Evaluates an expression
 */
function evaluateExpression(
  expr: ExpressionSpec,
  inputs: Map<string, Signal>,
  gadget: Gadget
): Signal {
  // Simple expression evaluation
  switch (expr.op) {
    case 'get':
      // Get input value
      return inputs.get(expr.args?.name as string) || { value: null, strength: 0 }
      
    case 'constant':
      // Return constant value
      return { value: expr.args?.value, strength: expr.args?.strength || 10000 }
      
    case 'add':
      // Add two values
      const a = inputs.get(expr.args?.a as string)
      const b = inputs.get(expr.args?.b as string)
      if (a && b && typeof a.value === 'number' && typeof b.value === 'number') {
        return {
          value: a.value + b.value,
          strength: Math.min(a.strength, b.strength)
        }
      }
      return { value: null, strength: 0 }
      
    default:
      return { value: null, strength: 0 }
  }
}

/**
 * Execute primitive operations
 */
function executePrimitive(
  name: string,
  params: any,
  inputs: Map<string, Signal>
): Map<string, Signal> {
  // Placeholder for primitive execution
  // Would integrate with existing primitives
  return new Map()
}

/**
 * Default propagation when no behavior is bound
 */
function defaultPropagate(
  inputs: Map<string, Signal>,
  gadget: Gadget
): Map<string, Signal> {
  const outputs = new Map<string, Signal>()
  
  // Just forward inputs to outputs with same name
  for (const [name, signal] of inputs) {
    const outputContact = gadget.contacts.get(name)
    if (outputContact && outputContact.direction === 'output') {
      outputs.set(name, signal)
    }
  }
  
  return outputs
}

// ============================================================================
// Template Interpretation
// ============================================================================

/**
 * Interprets a template signal to create a gadget
 */
export function interpretTemplate(template: TemplateSignal | any): Gadget {
  // Handle both tagged and untagged templates
  const templateData = template.tag === 'template' ? template : template
  
  if (!templateData || (templateData.tag && templateData.tag !== 'template')) {
    throw new Error('Not a template signal')
  }
  
  const value = templateData.tag === 'template' ? templateData.value : templateData
  const { gadgetType, spec, params } = value
  
  if (spec) {
    // Create from spec
    return createDynamicGadget(`spawn_${Date.now()}`, spec)
  }
  
  // Would look up gadgetType in registry
  throw new Error(`Unknown gadget type: ${gadgetType}`)
}