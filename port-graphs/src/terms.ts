// ================================
// Terms
// ================================

export type Opaque<T = unknown> = ['opaque', T]
export type Atom = string | number | boolean | symbol | symbol | Opaque // opaque term, used for embedding host langugae data, such as functions
export type Term =
    | Atom
    | Term[]
    | { [key: string]: Term }

export type Predicate = (term: Term) => boolean

// Transportable term, can be sent over the wire
// The only difference between Term is the exclusion of opaque terms
export type Transportable = string | number | boolean | symbol | Transportable[] | { [key: string]: Transportable }

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
export const contradictionp: Predicate = term => term === Contradiction || (Array.isArray(term) && term[0] === Contradiction)

// ================================
// Logical Merge Operations for TMS
// ================================

/**
 * Logical OR merge function - combines premises with logical OR
 * Addition means logical OR: any premise can be satisfied
 */
export const logicalOrMerge = (current: Term, incoming: Term): Term => {
  if (current === Nothing) return incoming
  if (current === incoming) return current // Idempotent
  
  // Create a logical OR term: ['or', premise1, premise2, ...]
  if (Array.isArray(current) && current[0] === 'or') {
    // Current is already an OR term, add the new premise
    return ['or', ...current.slice(1), incoming] as Term[]
  }
  
  if (Array.isArray(incoming) && incoming[0] === 'or') {
    // Incoming is an OR term, add current to it
    return ['or', current, ...incoming.slice(1)] as Term[]
  }
  
  // Create new OR term
  return ['or', current, incoming] as Term[]
}

/**
 * Logical AND merge function - combines premises with logical AND
 * Multiplication means logical AND: all premises must be satisfied
 */
export const logicalAndMerge = (current: Term, incoming: Term): Term => {
  if (current === Nothing) return incoming
  if (current === incoming) return current // Idempotent
  
  // Create a logical AND term: ['and', premise1, premise2, ...]
  if (Array.isArray(current) && current[0] === 'and') {
    // Current is already an AND term, add the new premise
    return ['and', ...current.slice(1), incoming] as Term[]
  }
  
  if (Array.isArray(incoming) && incoming[0] === 'and') {
    // Incoming is an AND term, add current to it
    return ['and', current, ...incoming.slice(1)] as Term[]
  }
  
  // Create new AND term
  return ['and', current, incoming] as Term[]
}

/**
 * Set difference merge function - removes elements from first set
 * Used for computing believed = all - nogoods
 */
export const setDifferenceMerge = (current: Term, incoming: Term): Term => {
  if (current === Nothing) return incoming
  if (Array.isArray(current) && Array.isArray(incoming)) {
    // If both are arrays, treat as sets and compute difference
    const currentSet = new Set(current)
    const incomingSet = new Set(incoming)
    return [...currentSet].filter(x => !incomingSet.has(x)) as Term[]
  }
  // If not arrays, return current
  return current
}

// Legacy function names for backward compatibility
export const setUnionMerge = logicalOrMerge

export const box = <T>(value: T): Opaque<T> => ['opaque', value]
export const unbox = <T>(term: Opaque<T>): T => term[1]