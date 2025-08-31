// ================================
// Type Predicates
// ================================

import { Term } from '../terms'
import { TermPredicate } from './types'

// Type checking predicates
export const isString: TermPredicate = (term) => typeof term === 'string'
export const isNumber: TermPredicate = (term) => typeof term === 'number'
export const isBoolean: TermPredicate = (term) => typeof term === 'boolean'
export const isSymbol: TermPredicate = (term) => typeof term === 'symbol'
export const isArray: TermPredicate = (term) => Array.isArray(term)
export const isObject: TermPredicate = (term) => 
  typeof term === 'object' && term !== null && !Array.isArray(term)

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
  (term: Term) => Array.isArray(term) && term.length === length

export const hasMinLength = (minLength: number): TermPredicate => 
  (term: Term) => Array.isArray(term) && term.length >= minLength

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
