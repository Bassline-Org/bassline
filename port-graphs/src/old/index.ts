/**
 * Old untyped API - preserved for reference/backward compatibility
 *
 * DEPRECATED: Use the typed API from the main export instead
 */

// Core untyped API
export * from './core';

// Untyped patterns
export * from './patterns/cells/numeric';
export * from './patterns/cells/set';
export * from './patterns/cells/maps';
export * from './patterns/cells/predicates';
export * from './patterns/cells/mapCell';
export * from './patterns/cells/position';

export * from './patterns/functions/numeric';

export * from './patterns/ui/slider';
export * from './patterns/ui/meter';
export * from './patterns/ui/calculator';

// Shared utilities (from parent)
export * from '../effects';
export * from '../semantics';
export * from '../multi';