/**
 * Type predicate gadgets - Scheme-style type checking
 */

import { createPrimitiveGadget } from './gadgets'
import { Gadget } from './types'

// ============================================================================
// Basic type predicates
// ============================================================================

/**
 * Check if value is a number
 */
export function createNumberP(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const v = inputs.get('value')
      return typeof v === 'number'
    },
    ['value'],
    ['output']
  )
}

/**
 * Check if value is a string
 */
export function createStringP(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const v = inputs.get('value')
      return typeof v === 'string'
    },
    ['value'],
    ['output']
  )
}

/**
 * Check if value is a boolean
 */
export function createBooleanP(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const v = inputs.get('value')
      return typeof v === 'boolean'
    },
    ['value'],
    ['output']
  )
}

/**
 * Check if value is null
 */
export function createNullP(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const v = inputs.get('value')
      return v === null
    },
    ['value'],
    ['output']
  )
}

/**
 * Check if value is an array
 */
export function createArrayP(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const v = inputs.get('value')
      return Array.isArray(v)
    },
    ['value'],
    ['output']
  )
}

/**
 * Check if value is an object (but not array or null)
 */
export function createObjectP(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const v = inputs.get('value')
      return v !== null && typeof v === 'object' && !Array.isArray(v)
    },
    ['value'],
    ['output']
  )
}

// ============================================================================
// Tagged value predicates
// ============================================================================

/**
 * Check if value has a specific tag
 */
export function createTagP(id: string, tagName: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const v = inputs.get('value')
      return v !== null && 
             typeof v === 'object' && 
             'tag' in (v as any) &&
             (v as any).tag === tagName
    },
    ['value'],
    ['output']
  )
}

/**
 * Check if value is a contradiction
 */
export function createContradictionP(id: string): Gadget {
  return createTagP(id + '_contradiction', 'contradiction')
}

// ============================================================================
// List predicates
// ============================================================================

/**
 * Check if list is empty
 */
export function createEmptyP(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const v = inputs.get('value')
      return Array.isArray(v) && v.length === 0
    },
    ['value'],
    ['output']
  )
}

/**
 * Check if value is a pair (2-element array)
 */
export function createPairP(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const v = inputs.get('value')
      return Array.isArray(v) && v.length === 2
    },
    ['value'],
    ['output']
  )
}

/**
 * Check if value is a non-empty list
 */
export function createListP(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const v = inputs.get('value')
      return Array.isArray(v) && v.length > 0
    },
    ['value'],
    ['output']
  )
}

// ============================================================================
// Compound predicates
// ============================================================================

/**
 * Check if value is defined (not null or undefined)
 */
export function createDefinedP(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const v = inputs.get('value')
      return v !== null && v !== undefined
    },
    ['value'],
    ['output']
  )
}

/**
 * Check if value is truthy
 */
export function createTruthyP(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const v = inputs.get('value')
      return !!v
    },
    ['value'],
    ['output']
  )
}

/**
 * Check if value is falsy
 */
export function createFalsyP(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const v = inputs.get('value')
      return !v
    },
    ['value'],
    ['output']
  )
}