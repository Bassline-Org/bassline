// ================================
// Logical Combinators
// ================================

import { Term } from '../terms'
import { TermPredicate, TermMap, PredicateCombinator, Pipeline, WhenMap } from './types'

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
  fns.reduceRight((acc, fn) => compose(acc, fn))

// ================================
// Utility Combinators
// ================================

// Identity function
export const id: TermMap<Term, Term> = (term: Term) => term

// Constant function
export const constant = <T>(value: T): TermMap<Term, T> => () => value
