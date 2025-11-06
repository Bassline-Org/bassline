/**
 * Aggregation Module - Public API
 *
 * Modular, extensible aggregation system for incremental computation.
 *
 * PRIMARY: Reified aggregations with explicit activation (like reified rules)
 * LEGACY: Old immediate activation (deprecated, for backward compatibility)
 */

// Core helpers (work with any versioned data)
export { addVersionedResult, getCurrentValue, getAllVersions } from './core.js';

// Built-in aggregation definitions
export { builtinAggregations } from './definitions.js';

// PRIMARY: Reified aggregations (explicit activation via memberOf)
export {
  installReifiedAggregations,
  deactivateAggregation,
  getActiveAggregations,
  getAggregationInfo
} from '../reified-aggregations.js';

// LEGACY: Old immediate activation (deprecated)
export { installAggregation } from './installer.js';
