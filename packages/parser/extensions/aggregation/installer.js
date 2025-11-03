/**
 * Aggregation Installer
 *
 * Registers watchers for aggregation operations.
 * Each operation gets its own specific watcher (no runtime dispatch).
 */

import { addVersionedResult } from './core.js';

/**
 * Install aggregation operations on a graph
 *
 * Creates a specific watcher for each operation that matches:
 * [?A AGGREGATE <OP_NAME>]
 *
 * @param {Graph} graph - The graph to install aggregations on
 * @param {Object} definitions - Map of operation name -> definition
 */
export function installAggregation(graph, definitions) {
  const activeAggregations = new Map();

  // Build a map of normalized operation names to definitions
  const normalizedDefs = new Map();
  for (const [opName, def] of Object.entries(definitions)) {
    normalizedDefs.set(opName.toUpperCase(), def);
  }

  // Watch for any AGGREGATE edge and check if it matches a definition (case-insensitive)
  graph.watch([["?A", "AGGREGATE", "?OP"]], (bindings) => {
    const aggId = bindings.get("?A");
    const opRaw = bindings.get("?OP");
    const opNormalized = opRaw.toString().toUpperCase();

    // Check if this operation is defined
    const def = normalizedDefs.get(opNormalized);
    if (!def) return;  // Unknown operation, ignore

    // Don't set up duplicate watchers for same aggregation
    if (activeAggregations.has(aggId)) return;

    // Initialize state from definition
    let state = typeof def.initialState === 'function'
      ? def.initialState()
      : { ...def.initialState };  // Clone to avoid shared state

    let version = 0;

    // Watch for items for THIS specific aggregation
    const unwatch = graph.watch([[aggId, "ITEM", "?V"]], (itemBindings) => {
      const rawValue = itemBindings.get("?V");

      // Let the definition handle the value (parsing, validation, etc.)
      state = def.accumulate(state, rawValue);
      version++;

      // Compute result using definition
      const result = def.reduce(state);

      // Add versioned result with refinement chain
      addVersionedResult(graph, aggId, version, result, state);
    });

    // Track active aggregation and its cleanup function
    activeAggregations.set(aggId, unwatch);
  });

  // Return cleanup function
  return () => {
    for (const unwatch of activeAggregations.values()) {
      unwatch();
    }
    activeAggregations.clear();
  };
}
