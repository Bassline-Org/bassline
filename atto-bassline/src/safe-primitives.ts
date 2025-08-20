/**
 * Type-safe primitive operations that output contradictions on type errors
 */

import { createPrimitiveGadget } from './gadgets'
import { Gadget, Value } from './types'
import { contradiction } from './tagged'

// ============================================================================
// Arithmetic operations (expect numbers)
// ============================================================================

/**
 * Safe addition - outputs contradiction if not numbers
 */
export function createSafeAdd(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = inputs.get('a')
      const b = inputs.get('b')
      
      if (typeof a !== 'number' || typeof b !== 'number') {
        return contradiction('Type error: expected numbers for addition', [a as Value, b as Value], id)
      }
      
      return a + b
    },
    ['a', 'b'],
    ['output']
  )
}

/**
 * Safe subtraction
 */
export function createSafeSubtract(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = inputs.get('a')
      const b = inputs.get('b')
      
      if (typeof a !== 'number' || typeof b !== 'number') {
        return contradiction('Type error: expected numbers for subtraction', [a as Value, b as Value], id)
      }
      
      return a - b
    },
    ['a', 'b'],
    ['output']
  )
}

/**
 * Safe multiplication
 */
export function createSafeMultiply(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = inputs.get('a')
      const b = inputs.get('b')
      
      if (typeof a !== 'number' || typeof b !== 'number') {
        return contradiction('Type error: expected numbers for multiplication', [a as Value, b as Value], id)
      }
      
      return a * b
    },
    ['a', 'b'],
    ['output']
  )
}

/**
 * Safe division - also checks for division by zero
 */
export function createSafeDivide(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = inputs.get('a')
      const b = inputs.get('b')
      
      if (typeof a !== 'number' || typeof b !== 'number') {
        return contradiction('Type error: expected numbers for division', [a as Value, b as Value], id)
      }
      
      if (b === 0) {
        return contradiction('Division by zero', [a as Value, b as Value], id)
      }
      
      return a / b
    },
    ['a', 'b'],
    ['output']
  )
}

// ============================================================================
// String operations (expect strings)
// ============================================================================

/**
 * Safe string concatenation
 */
export function createSafeConcat(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = inputs.get('a')
      const b = inputs.get('b')
      
      if (typeof a !== 'string' || typeof b !== 'string') {
        return contradiction('Type error: expected strings for concatenation', [a as Value, b as Value], id)
      }
      
      return a + b
    },
    ['a', 'b'],
    ['output']
  )
}

/**
 * Safe string length
 */
export function createSafeStringLength(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const s = inputs.get('string')
      
      if (typeof s !== 'string') {
        return contradiction('Type error: expected string for length', [s as Value], id)
      }
      
      return s.length
    },
    ['string'],
    ['output']
  )
}

// ============================================================================
// Boolean operations (expect booleans)
// ============================================================================

/**
 * Safe AND operation
 */
export function createSafeAnd(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = inputs.get('a')
      const b = inputs.get('b')
      
      if (typeof a !== 'boolean' || typeof b !== 'boolean') {
        return contradiction('Type error: expected booleans for AND', [a as Value, b as Value], id)
      }
      
      return a && b
    },
    ['a', 'b'],
    ['output']
  )
}

/**
 * Safe OR operation
 */
export function createSafeOr(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = inputs.get('a')
      const b = inputs.get('b')
      
      if (typeof a !== 'boolean' || typeof b !== 'boolean') {
        return contradiction('Type error: expected booleans for OR', [a as Value, b as Value], id)
      }
      
      return a || b
    },
    ['a', 'b'],
    ['output']
  )
}

/**
 * Safe NOT operation
 */
export function createSafeNot(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = inputs.get('value')
      
      if (typeof a !== 'boolean') {
        return contradiction('Type error: expected boolean for NOT', [a as Value], id)
      }
      
      return !a
    },
    ['value'],
    ['output']
  )
}

// ============================================================================
// Comparison operations
// ============================================================================

/**
 * Safe equality check
 */
export function createSafeEquals(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = inputs.get('a')
      const b = inputs.get('b')
      
      // Equality can work on any types
      return a === b
    },
    ['a', 'b'],
    ['output']
  )
}

/**
 * Safe greater than
 */
export function createSafeGreaterThan(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = inputs.get('a')
      const b = inputs.get('b')
      
      if (typeof a !== 'number' || typeof b !== 'number') {
        return contradiction('Type error: expected numbers for comparison', [a as Value, b as Value], id)
      }
      
      return a > b
    },
    ['a', 'b'],
    ['output']
  )
}

/**
 * Safe less than
 */
export function createSafeLessThan(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = inputs.get('a')
      const b = inputs.get('b')
      
      if (typeof a !== 'number' || typeof b !== 'number') {
        return contradiction('Type error: expected numbers for comparison', [a as Value, b as Value], id)
      }
      
      return a < b
    },
    ['a', 'b'],
    ['output']
  )
}

// ============================================================================
// Interval operations (pairs of numbers)
// ============================================================================

/**
 * Add two intervals [min1, max1] + [min2, max2]
 */
export function createIntervalAdd(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = inputs.get('a')
      const b = inputs.get('b')
      
      if (!Array.isArray(a) || a.length !== 2 || 
          typeof a[0] !== 'number' || typeof a[1] !== 'number') {
        return contradiction('Type error: expected interval [min, max] for first argument', [a as Value], id)
      }
      
      if (!Array.isArray(b) || b.length !== 2 || 
          typeof b[0] !== 'number' || typeof b[1] !== 'number') {
        return contradiction('Type error: expected interval [min, max] for second argument', [b as Value], id)
      }
      
      return [a[0] + b[0], a[1] + b[1]]
    },
    ['a', 'b'],
    ['output']
  )
}

/**
 * Multiply two intervals
 */
export function createIntervalMultiply(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = inputs.get('a')
      const b = inputs.get('b')
      
      if (!Array.isArray(a) || a.length !== 2 || 
          typeof a[0] !== 'number' || typeof a[1] !== 'number') {
        return contradiction('Type error: expected interval for first argument', [a as Value], id)
      }
      
      if (!Array.isArray(b) || b.length !== 2 || 
          typeof b[0] !== 'number' || typeof b[1] !== 'number') {
        return contradiction('Type error: expected interval for second argument', [b as Value], id)
      }
      
      // All possible products
      const products = [
        a[0] * b[0],
        a[0] * b[1],
        a[1] * b[0],
        a[1] * b[1]
      ]
      
      return [Math.min(...products), Math.max(...products)]
    },
    ['a', 'b'],
    ['output']
  )
}