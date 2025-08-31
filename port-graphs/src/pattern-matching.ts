import { Term, TaggedTerm, OrTerm, AndTerm, PremiseTerm, ConstraintTerm } from './terms'

// ================================
// Tagged Term Helpers
// ================================

export const createTaggedTerm = <T extends string>(tag: T, ...values: Term[]): TaggedTerm<T> => 
  [tag, ...values] as TaggedTerm<T>

export const createOrTerm = (...values: Term[]): OrTerm => 
  createTaggedTerm('or', ...values)

export const createAndTerm = (...values: Term[]): AndTerm => 
  createTaggedTerm('and', ...values)

export const createPremiseTerm = (...values: Term[]): PremiseTerm => 
  createTaggedTerm('premise', ...values)

export const createConstraintTerm = (...values: Term[]): ConstraintTerm => 
  createTaggedTerm('constraint', ...values)

// ================================
// Simple Lisp-style Combinators
// ================================

// Basic tag checking - works with [tag, ...terms] structure
export const tagged = (tag: string) => (term: Term): boolean => 
  Array.isArray(term) && term[0] === tag

// Body type checking - works with [tag, ...terms] structure
export const hasBodyType = (bodyType: string) => (term: Term): boolean => 
  Array.isArray(term) && term.length > 1 && Array.isArray(term[1]) && term[1][0] === bodyType

// Logical combinators
export const and = (...predicates: ((term: Term) => boolean)[]) => 
  (term: Term): boolean => predicates.every(p => p(term))

export const or = (...predicates: ((term: Term) => boolean)[]) =>
  (term: Term): boolean => predicates.some(p => p(term))

export const not = (predicate: (term: Term) => boolean) =>
  (term: Term): boolean => !predicate(term)

// ================================
// Simple Extraction Functions
// ================================

// Like (cdr input) - get everything after the first element
export const tail = (term: Term): Term[] => {
  if (Array.isArray(term) && term.length > 1) {
    return term.slice(1) as Term[]
  }
  return []
}

// Like (cadr input) - get the second element
export const second = (term: Term): Term => {
  if (Array.isArray(term) && term[0] === 'tagged' && term.length > 2) {
    // For tagged terms, return the tag (second element)
    return term[1] as Term
  }
  if (Array.isArray(term) && term.length > 1) {
    // For regular arrays, return the second element
    return term[1] as Term
  }
  throw new Error(`Expected array with at least 2 elements, got: ${JSON.stringify(term)}`)
}



// ================================
// Predicates Using Combinators
// ================================

// Basic semantic type predicates
export const orSetP = tagged("or")
export const andSetP = tagged("and")
export const premiseP = tagged("premise")
export const constraintP = tagged("constraint")

// Body structure predicates
export const setP = hasBodyType("set")
export const listP = hasBodyType("list")
export const recordP = hasBodyType("record")

// Combined predicates
export const orSetSetP = and(orSetP, setP)
export const andSetSetP = and(andSetP, setP)
export const premiseRecordP = and(premiseP, recordP)
export const constraintMapP = and(constraintP, hasBodyType("map"))

// Logical combinations
export const logicalSetP = or(orSetSetP, andSetSetP)
export const dataStructureP = or(premiseRecordP, constraintMapP)
