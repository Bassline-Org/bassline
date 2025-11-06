/**
 * Reified Aggregations
 *
 * Aggregations stored as edges with explicit activation pattern.
 * Similar to reified rules - define structure, then activate via memberOf.
 *
 * Pattern:
 * 1. Define aggregation structure as edges:
 *    graph.add("AGG1", "AGGREGATE", "SUM", null);
 *    graph.add("AGG1", "ITEM", 10, null);
 *    graph.add("AGG1", "ITEM", 20, null);
 *
 * 2. Activate (makes it reactive):
 *    graph.add("AGG1", "memberOf", "aggregation", "system");
 *
 * 3. Continuously reactive - new items auto-update:
 *    graph.add("AGG1", "ITEM", 30, null);  // Triggers recomputation
 *
 * 4. Query current value (uses refinement via NAC):
 *    getCurrentValue(graph, "AGG1");
 */

import { addVersionedResult } from './aggregation/core.js';

/**
 * Install reified aggregations system
 *
 * Watches for aggregation activation via memberOf pattern.
 * When activated, sets up continuous reactive watcher for new items.
 *
 * @param {Graph} graph - The graph instance
 * @param {Object} definitions - Map of operation name -> definition
 * @param {Object} context - Runtime context for tracking active aggregations
 * @returns {Function} Cleanup function to remove main watcher
 */
export function installReifiedAggregations(graph, definitions, context) {
  // Initialize context storage for active aggregations
  if (!context.aggregations) {
    context.aggregations = new Map();
  }

  // Build normalized definitions map
  const normalizedDefs = new Map();
  for (const [opName, def] of Object.entries(definitions)) {
    const normalized = opName.toUpperCase();
    normalizedDefs.set(normalized, def);

    // Self-describe each aggregation type
    graph.add(normalized, "TYPE", "AGGREGATION!", "system");
    if (def.docs) {
      graph.add(normalized, "DOCS", def.docs, "system");
    }
  }

  // Mark AGGREGATION! as a type
  graph.add("AGGREGATION!", "TYPE", "TYPE!", "system");

  // Watch for activation: [?agg memberOf aggregation system]
  const mainUnwatch = graph.watch([["?agg", "memberOf", "aggregation", "system"]], (bindings) => {
    const aggId = bindings.get("?agg");

    // Prevent duplicate activation
    if (context.aggregations.has(aggId)) {
      console.warn(`[ReifiedAggregations] Aggregation ${aggId} already active, ignoring duplicate activation`);
      return;
    }

    // Query aggregation type
    const typeQuery = graph.query([aggId, "AGGREGATE", "?type", "*"]);
    if (typeQuery.length === 0) {
      console.error(`[ReifiedAggregations] No AGGREGATE type found for ${aggId}`);
      return;
    }

    const aggType = typeQuery[0].get("?type");
    const aggTypeNormalized = aggType.toString().toUpperCase();

    // Get aggregation definition
    const def = normalizedDefs.get(aggTypeNormalized);
    if (!def) {
      console.error(`[ReifiedAggregations] Unknown aggregation type: ${aggType}`);
      return;
    }

    console.log(`[ReifiedAggregations] Activating aggregation: ${aggId} (type: ${aggTypeNormalized})`);

    // Initialize state
    let state = typeof def.initialState === 'function'
      ? def.initialState()
      : { ...def.initialState };  // Clone to avoid shared state

    let version = 0;

    // Process existing items (initial scan)
    const existingItems = graph.query([aggId, "ITEM", "?value", "*"]);
    for (const item of existingItems) {
      const value = item.get("?value");
      state = def.accumulate(state, value);
      version++;
    }

    // Write initial result if we had existing items
    if (existingItems.length > 0) {
      const initialResult = def.reduce(state);
      addVersionedResult(graph, aggId, version, initialResult, state);
      console.log(`[ReifiedAggregations] ${aggId}: Initial result from ${existingItems.length} items: ${initialResult}`);
    }

    // Install reactive watcher for new items
    const itemUnwatch = graph.watch([[aggId, "ITEM", "?value", "*"]], (itemBindings) => {
      const value = itemBindings.get("?value");

      // Accumulate new value
      state = def.accumulate(state, value);
      version++;

      // Compute new result
      const result = def.reduce(state);

      // Write versioned result with refinement chain
      addVersionedResult(graph, aggId, version, result, state);

      console.log(`[ReifiedAggregations] ${aggId}: Updated to ${result} (version ${version})`);
    });

    // Track active aggregation
    context.aggregations.set(aggId, {
      unwatch: itemUnwatch,
      state,
      aggType: aggTypeNormalized,
      version
    });

    console.log(`[ReifiedAggregations] ${aggId} activated successfully`);
  });

  // Return cleanup function
  return () => {
    mainUnwatch();
    for (const { unwatch } of context.aggregations.values()) {
      unwatch();
    }
    context.aggregations.clear();
  };
}

/**
 * Deactivate an aggregation
 *
 * @param {Graph} graph - The graph instance
 * @param {Object} context - Runtime context
 * @param {string} aggId - Aggregation ID to deactivate
 */
export function deactivateAggregation(graph, context, aggId) {
  const agg = context.aggregations.get(aggId);
  if (!agg) {
    console.warn(`[ReifiedAggregations] Cannot deactivate ${aggId}: not active`);
    return;
  }

  // Remove watcher
  agg.unwatch();

  // Remove from context
  context.aggregations.delete(aggId);

  // Remove memberOf edge (tombstone)
  graph.add(aggId, "memberOf", "aggregation", "tombstone");

  console.log(`[ReifiedAggregations] Deactivated aggregation: ${aggId}`);
}

/**
 * Get all active aggregations
 *
 * @param {Object} context - Runtime context
 * @returns {Array<string>} List of active aggregation IDs
 */
export function getActiveAggregations(context) {
  return Array.from(context.aggregations.keys());
}

/**
 * Get aggregation info
 *
 * @param {Object} context - Runtime context
 * @param {string} aggId - Aggregation ID
 * @returns {Object|null} Aggregation info or null if not active
 */
export function getAggregationInfo(context, aggId) {
  const agg = context.aggregations.get(aggId);
  if (!agg) return null;

  return {
    aggId,
    type: agg.aggType,
    version: agg.version,
    state: agg.state
  };
}
