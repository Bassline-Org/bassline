// ================================
// Core Term Types
// ================================

// Simple, flexible term type that works with our combinator system
export type Term = string | number | boolean | symbol | null | Term[] | { [key: string]: Term }

// Common symbols used throughout the system
export const Nothing = Symbol('Nothing')
export const Contradiction = Symbol('Contradiction')