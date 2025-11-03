/**
 * Aggregation Module - Public API
 *
 * Modular, extensible aggregation system for incremental computation.
 */

// Core helpers (work with any versioned data)
export { addVersionedResult, getCurrentValue, getAllVersions } from './core.js';

// Built-in aggregation definitions
export { builtinAggregations } from './definitions.js';

// Installer function
export { installAggregation } from './installer.js';
