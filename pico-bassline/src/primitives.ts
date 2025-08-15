/**
 * Pico-Bassline Primitives
 * Minimal set of binary operations for computation
 */

import { PrimitiveProps, Value, Properties } from './types'

/**
 * Helper to create primitive properties
 */
function primitive(
  name: string,
  compute: (inputs: Record<string, Value>, props: Properties) => Value,
  extraProps: Partial<PrimitiveProps> = {}
): PrimitiveProps {
  return {
    primitive: true,
    name,
    compute,
    ...extraProps
  }
}

/**
 * Type-safe value extraction helpers
 */
function asNumber(value: Value): number {
  return typeof value === 'number' ? value : 0
}

function asBoolean(value: Value): boolean {
  return Boolean(value)
}

function asString(value: Value): string {
  return String(value ?? '')
}

/**
 * Basic primitive operations - binary only!
 */
export const primitives = {
  // Math operations (binary)
  add: () => primitive('add', 
    ({ a, b }) => asNumber(a) + asNumber(b)
  ),
  
  subtract: () => primitive('subtract',
    ({ a, b }) => asNumber(a) - asNumber(b)
  ),
  
  multiply: () => primitive('multiply',
    ({ a, b }) => asNumber(a) * asNumber(b)
  ),
  
  divide: () => primitive('divide',
    ({ a, b }) => {
      const divisor = asNumber(b)
      return divisor !== 0 ? asNumber(a) / divisor : 0
    }
  ),
  
  max: () => primitive('max',
    ({ a, b }) => Math.max(asNumber(a), asNumber(b))
  ),
  
  min: () => primitive('min',
    ({ a, b }) => Math.min(asNumber(a), asNumber(b))
  ),
  
  // Logic operations
  and: () => primitive('and',
    ({ a, b }) => asBoolean(a) && asBoolean(b)
  ),
  
  or: () => primitive('or',
    ({ a, b }) => asBoolean(a) || asBoolean(b)
  ),
  
  not: () => primitive('not',
    ({ value }) => !asBoolean(value)
  ),
  
  // Comparison operations
  equals: () => primitive('equals',
    ({ a, b }) => a === b
  ),
  
  greater: () => primitive('greater',
    ({ a, b }) => asNumber(a) > asNumber(b)
  ),
  
  less: () => primitive('less',
    ({ a, b }) => asNumber(a) < asNumber(b)
  ),
  
  greaterEqual: () => primitive('greaterEqual',
    ({ a, b }) => asNumber(a) >= asNumber(b)
  ),
  
  lessEqual: () => primitive('lessEqual',
    ({ a, b }) => asNumber(a) <= asNumber(b)
  ),
  
  // Control flow
  gate: () => primitive('gate',
    ({ value, condition }) => asBoolean(condition) ? value : undefined
  ),
  
  select: () => primitive('select',
    ({ condition, a, b }) => asBoolean(condition) ? a : b
  ),
  
  // String operations
  concat: () => primitive('concat',
    ({ a, b }) => asString(a) + asString(b)
  ),
  
  // Special operations for merges (work with [new, old] pairs)
  maxMerge: () => primitive('max-merge',
    (inputs) => {
      // Expects a single input that is a [new, old] pair
      const input = Object.values(inputs)[0] as [Value, Value] | undefined
      if (!input || !Array.isArray(input)) return 0
      
      const [newVal, oldVal] = input
      return Math.max(asNumber(newVal), asNumber(oldVal))
    },
    { needsHistory: true }
  ),
  
  minMerge: () => primitive('min-merge',
    (inputs) => {
      const input = Object.values(inputs)[0] as [Value, Value] | undefined
      if (!input || !Array.isArray(input)) return 0
      
      const [newVal, oldVal] = input
      return Math.min(asNumber(newVal), asNumber(oldVal))
    },
    { needsHistory: true }
  ),
  
  acceptLast: () => primitive('accept-last',
    (inputs) => {
      const input = Object.values(inputs)[0] as [Value, Value] | undefined
      if (!input || !Array.isArray(input)) return undefined
      
      const [newVal] = input
      return newVal
    },
    { needsHistory: true }
  ),
  
  keepFirst: () => primitive('keep-first',
    (inputs) => {
      const input = Object.values(inputs)[0] as [Value, Value] | undefined
      if (!input || !Array.isArray(input)) return undefined
      
      const [newVal, oldVal] = input
      return oldVal ?? newVal
    },
    { needsHistory: true }
  )
}

/**
 * Helper to create a primitive group with standard contacts
 */
export function createPrimitive(
  props: PrimitiveProps,
  inputNames: string[] = ['a', 'b'],
  outputName: string = 'output'
): Properties {
  // Return properties that include contact definitions
  return {
    ...props,
    inputContacts: inputNames,
    outputContact: outputName
  }
}