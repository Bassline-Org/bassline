// ================================
// Core Types
// ================================

import { Term } from '../terms'

export type TermMap<In = Term, Out = Term> = (input: In) => Out
export type TermPredicate = TermMap<Term, boolean>

// Higher-order predicate combinators that take predicates and return new predicates
export type PredicateCombinator = (...predicates: TermPredicate[]) => TermPredicate

// Pipeline combinator - chains transformations
export type Pipeline<T = Term> = (...transforms: TermMap<T, T>[]) => TermMap<T, T>

// Conditional transformation types
export type IfMap<T = Term, F = Term> = (
    predicate: TermPredicate,
    ifTrue: TermMap<Term, T>,
    ifFalse: TermMap<Term, F>,
) => TermMap<Term, T | F>

// One side of an if-map
export type WhenMap<T = Term> = (predicate: TermPredicate, ifTrue: TermMap<Term, T>) => TermMap<Term, T | Term>
export const when: WhenMap = (predicate, transform) => 
  (term: Term) => predicate(term) ? transform(term) : term