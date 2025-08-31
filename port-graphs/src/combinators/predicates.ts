// ================================
// Type Predicates
// ================================

import { Term } from '../terms'
import { and, constant } from './combinators'

// Define types inline since we deleted types.ts
export type TermMap<In = Term, Out = Term> = (input: In) => Out
export type TermPredicate = TermMap<Term, boolean>

// Type checking predicates
export const isString: TermPredicate = (term) => typeof term === 'string'
export const isNumber: TermPredicate = (term) => typeof term === 'number'
export const isBoolean: TermPredicate = (term) => typeof term === 'boolean'
export const isSymbol: TermPredicate = (term) => typeof term === 'symbol'
export const isArray: TermPredicate = (term) => Array.isArray(term)
export const isObject: TermPredicate = (term) => 
  typeof term === 'object' && term !== null && !Array.isArray(term)

export const constants = {
  true: constant(true),
  false: constant(false),
}

// ================================
// Structural Predicates
// ================================

// Tagged term predicates
export const hasTag = (tag: string): TermPredicate => 
  (term: Term) => Array.isArray(term) && term[0] === tag

export const isTagged = (tag: string): TermPredicate => 
  (term: Term) => Array.isArray(term) && term[0] === tag

// Array structure predicates
export const hasLength = (length: number): TermPredicate => 
  and(
    isArray,
    (term: Term) => (term as Term[]).length === length
  )

export const hasMinLength = (minLength: number): TermPredicate => 
  and(
    isArray,
    (term: Term) => (term as Term[]).length >= minLength
  )

// ================================
// Structural Matching Combinators
// ================================

export const sequence = (...predicates: TermPredicate[]): TermPredicate =>
  (term: Term) => {
    if (!isArray(term)) return false
    const listTerm = term as Term[]
    return predicates.every((pred, index) => {
      const item = listTerm[index]
      if (!item) return false
      return pred(item)
    })
  }

// Matches arrays that start with a sequence of predicates
export const startsWith = (...predicates: TermPredicate[]): TermPredicate =>
  and(
    isArray,
    hasMinLength(predicates.length),
    sequence(...predicates)
  )

// Matches arrays that have a specific structure
export const hasStructure = (structure: TermPredicate[]): TermPredicate =>
  and(
    isArray,
    hasLength(structure.length),
    sequence(...structure)
  )

// ================================
// Comparison Predicates
// ================================

export const eq = (value: Term): TermPredicate => (term: Term) => term === value
export const ne = (value: Term): TermPredicate => (term: Term) => term !== value

// Numeric comparison predicates
export const gt = (value: number): TermPredicate => (term: Term) => 
  typeof term === 'number' && term > value

export const lt = (value: number): TermPredicate => (term: Term) => 
  typeof term === 'number' && term < value

export const gte = (value: number): TermPredicate => (term: Term) => 
  typeof term === 'number' && term >= value

export const lte = (value: number): TermPredicate => (term: Term) => 
  typeof term === 'number' && term <= value

export const inRange = (min: number, max: number): TermPredicate => (term: Term) => 
  typeof term === 'number' && term >= min && term <= max
