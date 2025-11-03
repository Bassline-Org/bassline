/**
 * Compute Operations (Modular)
 *
 * Arithmetic, unary, and comparison operations for pattern-based computation.
 *
 * This module re-exports from the modular structure:
 * - compute/definitions.js: Operation specifications
 * - compute/installer.js: Graph installation logic
 *
 * Maintains backward compatibility with existing code.
 */

// Re-export compute functionality
export { installCompute } from './compute/installer.js';
export { builtinOperations } from './compute/definitions.js';

// Re-export aggregation functionality for backward compatibility
export {
  addVersionedResult,
  getCurrentValue,
  getAllVersions,
  builtinAggregations,
  installAggregation
} from './aggregation/index.js';
