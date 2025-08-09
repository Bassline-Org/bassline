/**
 * Core primitive module - exports all built-in primitives as functions
 * This is the main module loaded by the PrimitiveLoaderDriver
 */

// Re-export all primitive functions from their respective modules
export * from './math'
export * from './string'
export * from './logic'
export * from './control'
export * from './array'