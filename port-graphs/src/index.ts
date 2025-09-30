// Core context.ts API (new model)
export * from './core/context';

// Core typed API (old model - for backward compatibility)
export * from './core/typed';

// Typed patterns
export * from './patterns/cells';
export * from './patterns/functions';
export * from './patterns/ui';
export * from './patterns/family';
export * from './patterns/io';

// Relations for wiring gadgets
export * from './relations';

// Meta-gadgets for contextual composition
export * from './meta/factoryBassline';

// Shared utilities
export * from './effects';
export * from './multi';