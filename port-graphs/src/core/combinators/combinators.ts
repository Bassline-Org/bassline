// ================================
// Logical Combinators
// ================================

import { Term } from '../terms'
import { z } from 'zod'

// Define types inline since we deleted types.ts
export type TermMap<In = Term, Out = Term> = (input: In) => Out
export type TermPredicate = TermMap<Term, boolean>
export type PredicateCombinator = (...predicates: TermPredicate[]) => TermPredicate
export type Pipeline<T = Term> = (...transforms: TermMap<T, T>[]) => TermMap<T, T>
export type WhenMap<T = Term> = (predicate: TermPredicate, ifTrue: TermMap<Term, T>) => TermMap<Term, T | Term>

// Logical OR - matches if ANY predicate matches
export const or: PredicateCombinator = (...predicates) => 
  (term: Term) => predicates.some(p => p(term))

// Logical AND - matches if ALL predicates match  
export const and: PredicateCombinator = (...predicates) => 
  (term: Term) => predicates.every(p => p(term))

// Logical NOT - negates a predicate
export const not = (predicate: TermPredicate): TermPredicate => 
  (term: Term) => !predicate(term)

// Logical NOR - matches if NO predicates match
export const nor: PredicateCombinator = (...predicates) => 
  (term: Term) => predicates.every(p => !p(term))

// ================================
// Transformation Combinators
// ================================

// Pipeline combinator - chains transformations
export const pipe: Pipeline = (...transforms) => 
  (term: Term) => transforms.reduce((acc, transform) => transform(acc), term)

// Conditional transformation
export const when: WhenMap = (predicate, transform) => 
  (term: Term) => predicate(term) ? transform(term) : term

// ================================
// Composition Helpers
// ================================

// Compose two functions (right-to-left)
export const compose = <A, B, C>(f: TermMap<B, C>, g: TermMap<A, B>): TermMap<A, C> =>
  (a: A) => f(g(a))

// Compose multiple functions (right-to-left)
export const composeMany = <T>(...fns: TermMap<T, T>[]): TermMap<T, T> =>
  fns.reduceRight((acc, fn) => compose(fn, acc))

// ================================
// Utility Combinators
// ================================

// Identity function
export const id: TermMap<Term, Term> = (term: Term) => term

// Constant function
export const constant = <T>(value: T): TermMap<Term, T> => () => value

// ================================
// Zod Integration
// ================================

// Zod schema validation combinator
export const zod = <T>(schema: z.ZodSchema<T>): TermMap<Term, T> => 
  (term: Term) => {
    try {
      return schema.parse(term)
    } catch {
      throw new Error(`Zod validation failed for term: ${JSON.stringify(term)}`)
    }
  }

// Zod predicate combinator (returns boolean instead of throwing)
export const zodPredicate = <T>(schema: z.ZodSchema<T>): TermPredicate => 
  (term: Term) => {
    try {
      schema.parse(term)
      return true
    } catch {
      return false
    }
  }
