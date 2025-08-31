// ================================
// Terms
// ================================

export type Opaque<T = unknown> = ['opaque', T]
export type Atom = string | number | boolean | symbol | symbol | Opaque // opaque term, used for embedding host langugae data, such as functions

// Generic tagged term: [tag, ...terms]
export type TaggedTerm<T extends string = string> = [T, ...Term[]]

// Specific tagged terms for common operations
export type OrTerm = TaggedTerm<'or'>
export type AndTerm = TaggedTerm<'and'>
export type PremiseTerm = TaggedTerm<'premise'>
export type ConstraintTerm = TaggedTerm<'constraint'>

export type Term =
    | Atom
    | TaggedTerm

export type Predicate = (term: Term) => boolean

// Transportable term, can be sent over the wire
// The only difference between Term is the exclusion of opaque terms
export type Transportable = string | number | boolean | symbol | Transportable[] | { [key: string]: Transportable }

import { orSetP, andSetP, tail, createOrTerm, createAndTerm } from './pattern-matching'

// ================================
// Predicates
// ================================

// Atom predicates
export const stringp: Predicate = term => typeof term === 'string'
export const numberp: Predicate = term => typeof term === 'number'
export const booleanp: Predicate = term => typeof term === 'boolean'
export const symbolp: Predicate = term => typeof term === 'symbol'
export const opaquep: Predicate = term => Array.isArray(term) && term[0] === 'opaque'

// Compound predicates
export const listp: Predicate = term => Array.isArray(term) && !opaquep(term)
export const dictp: Predicate = term => typeof term === 'object' && term !== null && !Array.isArray(term)

// General predicates
export const atomp: Predicate = term => stringp(term) || numberp(term) || booleanp(term) || symbolp(term) || opaquep(term)
export const compoundp: Predicate = term => listp(term) || dictp(term)

// Common symbols
export const Nothing = Symbol('Nothing')
export const Contradiction = Symbol('Contradiction')

export const nothingp: Predicate = term => term === Nothing
export const contradictionp: Predicate = term => term === Contradiction || (Array.isArray(term) && term[0] === 'contradiction')

// ================================
// Logical Merge Operations for TMS
// ================================

/**
 * Logical OR merge function - combines premises with logical OR
 * Addition means logical OR: any premise can be satisfied
 */
export const logicalOrMerge = (current: Term, incoming: Term): Term => {
  if (current === Nothing) {
    // When starting fresh, create a logical OR wrapper
    return createOrTerm(incoming)
  }
  if (current === incoming) return current // Idempotent
  
  // Create a logical OR term: ['or', premise1, premise2, ...]
  if (orSetP(current)) {
    // Current is already an OR term, add the new premise
    return createOrTerm(...tail(current), incoming)
  }
  
  if (orSetP(incoming)) {
    // Incoming is an OR term, add current to it
    return createOrTerm(current, ...tail(incoming))
  }
  
  // Create new OR term
  return createOrTerm(current, incoming)
}

/**
 * Logical AND merge function - combines premises with logical AND
 * Multiplication means logical AND: all premises must be satisfied
 */
export const logicalAndMerge = (current: Term, incoming: Term): Term => {
  if (current === Nothing) return incoming
  if (current === incoming) return current // Idempotent
  
  // Create a logical AND term: ['and', premise1, premise2, ...]
  if (andSetP(current)) {
    // Current is already an AND term, add the new premise
    return createAndTerm(...tail(current), incoming)
  }
  
  if (andSetP(incoming)) {
    // Incoming is an AND term, add current to it
    return createAndTerm(current, ...tail(incoming))
  }
  
  // Create new AND term
  return createAndTerm(current, incoming)
}

/**
 * Set difference merge function - removes elements from first set
 * Used for computing believed = all - nogoods
 * Handles both simple arrays and logical OR structures: ['or', premise1, premise2, ...]
 */
export const setDifferenceMerge = (current: Term, incoming: Term): Term => {
  if (current === Nothing) return incoming
  
  // Extract premises from logical OR structures or treat as simple arrays
  const extractPremises = (term: Term): Term[] => {
    if (orSetP(term)) {
      return tail(term)
    }
    if (Array.isArray(term)) {
      return term as Term[] // Simple array
    }
    return [term] // Single value
  }
  
  const currentPremises = extractPremises(current)
  const incomingPremises = extractPremises(incoming)
  
  // Compute set difference by filtering out incoming premises
  const resultPremises = currentPremises.filter(currentPremise => 
    !incomingPremises.some(incomingPremise => 
      // Deep equality check for premises
      Array.isArray(currentPremise) && Array.isArray(incomingPremise) 
        ? currentPremise.length === incomingPremise.length && 
          currentPremise.every((val, idx) => val === incomingPremise[idx])
        : currentPremise === incomingPremise
    )
  )
  
  // Return as logical OR structure
  if (resultPremises.length === 0) {
    return createOrTerm() // Empty OR
  } else if (resultPremises.length === 1) {
    return resultPremises[0]! // Single premise, no need for OR wrapper
  } else {
    return createOrTerm(...resultPremises) // Multiple premises with OR wrapper
  }
}

// Legacy function names for backward compatibility
export const setUnionMerge = logicalOrMerge

export const box = <T>(value: T): Opaque<T> => ['opaque', value]
export const unbox = <T>(term: Opaque<T>): T => term[1]