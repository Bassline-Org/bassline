/**
 * Aggregation Module - Public API
 *
 * Modular, extensible aggregation system for incremental computation.
 * Uses reified aggregations with explicit activation (like reified rules).
 */

// Core helpers (work with any versioned data)
export { addVersionedResult, getAllVersions, getCurrentValue } from "./core.js";

// Built-in aggregation definitions
export { builtinAggregations } from "./definitions.js";

// Reified aggregations (explicit activation via memberOf)
export {
  deactivateAggregation,
  getActiveAggregations,
  getAggregationInfo,
  installReifiedAggregations,
} from "../reified-aggregations.js";
