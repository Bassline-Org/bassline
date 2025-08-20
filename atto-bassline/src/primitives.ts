/**
 * Primitive gadgets that use MIN strength for information-destroying operations
 */

import { createPrimitiveGadget } from './gadgets'

// ============================================================================
// Arithmetic operations
// ============================================================================

export function createAdder(id: string) {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = (inputs.get('a') as number) ?? 0
      const b = (inputs.get('b') as number) ?? 0
      return a + b
    },
    ['a', 'b'],
    ['output']
  )
}

export function createMultiplier(id: string) {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = (inputs.get('a') as number) ?? 1
      const b = (inputs.get('b') as number) ?? 1
      return a * b
    },
    ['a', 'b'],
    ['output']
  )
}

export function createSubtractor(id: string) {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = (inputs.get('a') as number) ?? 0
      const b = (inputs.get('b') as number) ?? 0
      return a - b
    },
    ['a', 'b'],
    ['output']
  )
}

export function createDivider(id: string) {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = (inputs.get('a') as number) ?? 0
      const b = (inputs.get('b') as number) ?? 1
      return b !== 0 ? a / b : null
    },
    ['a', 'b'],
    ['output']
  )
}

// ============================================================================
// String operations
// ============================================================================

export function createConcatenator(id: string) {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = String(inputs.get('a') ?? '')
      const b = String(inputs.get('b') ?? '')
      return a + b
    },
    ['a', 'b'],
    ['output']
  )
}

// ============================================================================
// Logic operations
// ============================================================================

export function createAnd(id: string) {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = Boolean(inputs.get('a'))
      const b = Boolean(inputs.get('b'))
      return a && b
    },
    ['a', 'b'],
    ['output']
  )
}

export function createOr(id: string) {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = Boolean(inputs.get('a'))
      const b = Boolean(inputs.get('b'))
      return a || b
    },
    ['a', 'b'],
    ['output']
  )
}

export function createNot(id: string) {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = Boolean(inputs.get('a'))
      return !a
    },
    ['a'],
    ['output']
  )
}

// ============================================================================
// Comparison operations
// ============================================================================

export function createEquals(id: string) {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = inputs.get('a')
      const b = inputs.get('b')
      return a === b
    },
    ['a', 'b'],
    ['output']
  )
}

export function createGreaterThan(id: string) {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = (inputs.get('a') as number) ?? 0
      const b = (inputs.get('b') as number) ?? 0
      return a > b
    },
    ['a', 'b'],
    ['output']
  )
}

export function createLessThan(id: string) {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = (inputs.get('a') as number) ?? 0
      const b = (inputs.get('b') as number) ?? 0
      return a < b
    },
    ['a', 'b'],
    ['output']
  )
}