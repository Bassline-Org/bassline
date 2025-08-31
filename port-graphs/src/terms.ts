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

export const box = <T>(value: T): Opaque<T> => ['opaque', value]
export const unbox = <T>(term: Opaque<T>): T => term[1]