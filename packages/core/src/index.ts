// ============================================
// @bassline/core - Core gadget primitives
// ============================================

// Core context.ts API
export * from './core/context';

// Standard behavioral protocols
export * as Protocols from './core/protocols';

// Pattern primitives
export * from './patterns/cells';
export * from './patterns/functions';

// ============================================
// Sugar Layer - Ergonomic APIs
// ============================================

// Sugar cells
export { cells, type SweetCell, setMetadata, withMetadata, type Metadata } from './sugar/cells';

// Sugar tables
export { table, type SweetTable } from './sugar/tables';

// Sugar functions
export { fn, type SweetFunction, type Fannable, derive, deriveFrom } from './sugar/functions';

// Cleanup type
export type { Cleanup } from './sugar/index';