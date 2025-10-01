// ============================================
// NEW SYSTEM: context.ts primitives (steps, handlers, protos)
// ============================================

// Core context.ts API
export * from './core/context';

// Standard behavioral protocols
export * as Protocols from './core/protocols';

// Pattern primitives
export * from './patterns/cells';
export * from './patterns/tables';
export * from './patterns/functions';
export * from './patterns/ui';
export * from './patterns/io';

// Relations for wiring gadgets
export * from './relations';

// Shared utilities
export * from './effects';
export * from './multi';

// ============================================
// OLD SYSTEM: typed.ts (not exported - kept for internal use)
// ============================================

// Core typed API (old model - not exported)
// export * from './core/typed';

// Meta-gadgets using old system (temporarily exported for demos)
export * from './meta/factoryBassline';
// export * from './patterns/family';