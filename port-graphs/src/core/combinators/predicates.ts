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

export const isDefined = (term: Term) => term !== undefined && term !== null

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

// ================================
// Object Predicates
// ================================

// Check if object has specific keys
export const hasKeys = (...keys: string[]): TermPredicate =>
  and(
    isObject,
    (term: Term) => {
      const obj = term as { [key: string]: Term }
      return keys.every(key => key in obj)
    }
  )

// Check if object has specific key-value pairs
export const hasKeyValue = (key: string, value: Term): TermPredicate =>
  and(
    isObject,
    (term: Term) => {
      const obj = term as { [key: string]: Term }
      return key in obj && obj[key] !== undefined && obj[key] === value
    }
  )

// Check if object has specific structure (array of key predicates)
export const objectStructure = (keyPredicates: Array<{ key: string; predicate: TermPredicate }>): TermPredicate =>
  and(
    isObject,
    (term: Term) => {
      const obj = term as { [key: string]: Term }
      return keyPredicates.every(({ key, predicate }) => 
        key in obj && obj[key] !== undefined && predicate(obj[key]!)
      )
    }
  )

// Check if object has minimum number of keys
export const hasMinKeys = (minKeys: number): TermPredicate =>
  and(
    isObject,
    (term: Term) => {
      const obj = term as { [key: string]: Term }
      return Object.keys(obj).length >= minKeys
    }
  )

// Check if object has exact number of keys
export const hasExactKeys = (exactKeys: number): TermPredicate =>
  and(
    isObject,
    (term: Term) => {
      const obj = term as { [key: string]: Term }
      return Object.keys(obj).length === exactKeys
    }
  )

// Check if object values match a sequence of predicates
export const objectValues = (...valuePredicates: TermPredicate[]): TermPredicate =>
  and(
    isObject,
    (term: Term) => {
      const obj = term as { [key: string]: Term }
      const values = Object.values(obj)
      return valuePredicates.every((pred, index) => 
        index < values.length && pred(values[index]!)
      )
    }
  )

// Check if term is null
export const isNull = (term: Term): boolean => term === null

// Check if term is null or undefined
export const isNullOrUndefined = (term: Term): boolean => term === null || term === undefined
