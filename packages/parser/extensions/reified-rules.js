/**
 * Reified Rules - Graph-native rule storage and activation
 *
 * Rules are stored as edges in the graph and activated via system contexts.
 * This enables full introspection, dynamic activation/deactivation, and
 * eliminates special runtime command handling.
 *
 * Pattern:
 * 1. Define rule structure as edges (quads stored as strings)
 * 2. Activate via memberOf edge: `RULE-NAME memberOf rule system`
 * 3. System watcher installs graph.watch based on stored patterns
 *
 * Example:
 *   graph.add("ADULT-CHECK", "TYPE", "RULE!", "system");
 *   graph.add("ADULT-CHECK", "matches", "?p AGE ?a *", "ADULT-CHECK");
 *   graph.add("ADULT-CHECK", "produces", "?p ADULT TRUE *", "ADULT-CHECK");
 *   graph.add("ADULT-CHECK", "memberOf", "rule", "system");
 */

import { resolve } from "../src/minimal-graph.js";
import { parsePatternQuad } from "../src/pattern-parser.js";

/**
 * Unwrap parser value objects to raw values
 * (Same logic as pattern-words.js unwrap)
 */
function unwrap(val) {
  if (val === null) return null;
  if (typeof val === 'object') {
    if (val.word) return val.word;
    if (val.number !== undefined) return val.number;
    if (val.string !== undefined) return val.string;
    if (val.patternVar) return `?${val.patternVar}`;
    if (val.wildcard) return "*";
  }
  return val;
}

/**
 * Parse a quad string and unwrap to simple tuple
 *
 * @param {string} quadStr - Quad string like "?x TYPE PERSON *"
 * @returns {Array} [source, attr, value, context] tuple
 */
export function parseQuadString(quadStr) {
  const parsed = parsePatternQuad(quadStr);
  return [
    unwrap(parsed[0]),
    unwrap(parsed[1]),
    unwrap(parsed[2]),
    unwrap(parsed[3])
  ];
}

/**
 * Install the rule activation watcher
 *
 * Watches for: `?rule memberOf rule system`
 * When seen, queries rule structure and installs watcher
 *
 * @param {Graph} graph - The graph instance
 * @param {Object} context - Runtime context (for storing unwatches)
 */
export function installReifiedRules(graph, context) {
  // Ensure context.rules exists
  if (!context.rules) {
    context.rules = new Map();
  }

  // Watch for rule activation
  graph.watch([["?rule", "memberOf", "rule", "system"]], (bindings) => {
    const ruleId = bindings.get("?rule");

    // Skip if already active
    if (context.rules.has(ruleId)) {
      return;
    }

    console.log(`[ReifiedRules] Activating rule: ${ruleId}`);

    try {
      // Query rule type (validate it's a rule)
      const typeQ = graph.query([ruleId, "TYPE", "?type", "system"]);
      if (typeQ.length === 0 || typeQ[0].get("?type") !== "RULE!") {
        console.warn(`[ReifiedRules] ${ruleId} has memberOf rule but no TYPE RULE! marker`);
        return;
      }

      // Query match patterns (stored as quad strings)
      const matchQuads = graph.query([ruleId, "matches", "?quadStr", "*"])
        .map(b => parseQuadString(b.get("?quadStr")));

      // Query produce patterns
      const produceQuads = graph.query([ruleId, "produces", "?quadStr", "*"])
        .map(b => parseQuadString(b.get("?quadStr")));

      // Query NAC (optional)
      const nacQuads = graph.query([ruleId, "nac", "?quadStr", "*"])
        .map(b => parseQuadString(b.get("?quadStr")));

      if (matchQuads.length === 0) {
        console.warn(`[ReifiedRules] ${ruleId} has no match patterns`);
        return;
      }

      if (produceQuads.length === 0) {
        console.warn(`[ReifiedRules] ${ruleId} has no produce patterns`);
        return;
      }

      console.log(`[ReifiedRules] ${ruleId}: ${matchQuads.length} match, ${produceQuads.length} produce, ${nacQuads.length} nac`);

      // Build match spec (with NAC if present)
      const matchSpec = nacQuads.length > 0
        ? { patterns: matchQuads, nac: nacQuads }
        : matchQuads;

      // Define the action to take when rule matches
      const fireRule = (matchBindings) => {
        // Resolve variables and produce
        for (const [s, a, v, c] of produceQuads) {
          const source = resolve(s, matchBindings);
          const attr = resolve(a, matchBindings);
          const value = resolve(v, matchBindings);
          const ctx = c ? resolve(c, matchBindings) : null;

          graph.add(source, attr, value, ctx);
        }

        // Record firing with unique ID to avoid deduplication
        const firingId = `${ruleId}:F${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
        graph.add(ruleId, "FIRED", firingId, "system");
        graph.add(firingId, "TIMESTAMP", Date.now(), "system");
      };

      // Install watcher for future edges
      const unwatch = graph.watch(matchSpec, fireRule);

      // Scan existing edges and fire for any matches
      const existingMatches = nacQuads.length > 0
        ? graph.query({ patterns: matchQuads, nac: nacQuads })
        : graph.query(...matchQuads);

      for (const matchBindings of existingMatches) {
        fireRule(matchBindings);
      }

      // Store rule info
      context.rules.set(ruleId, {
        matchQuads,
        produceQuads,
        nacQuads,
        unwatch,
      });

      console.log(`[ReifiedRules] ${ruleId} activated successfully`);

    } catch (error) {
      console.error(`[ReifiedRules] Failed to activate ${ruleId}:`, error);
    }
  });

  // Watch for deactivation
  graph.watch([["?rule", "memberOf", "rule", "tombstone"]], (bindings) => {
    const ruleId = bindings.get("?rule");

    const ruleInfo = context.rules.get(ruleId);
    if (ruleInfo) {
      console.log(`[ReifiedRules] Deactivating rule: ${ruleId}`);

      // Unwatch
      if (ruleInfo.unwatch) {
        ruleInfo.unwatch();
      }

      // Remove from context
      context.rules.delete(ruleId);

      // Mark as inactive
      graph.add(ruleId, "STATUS", "INACTIVE", "system");
    }
  });

  // Mark RULE! as a type
  graph.add("RULE!", "TYPE", "TYPE!", "system");
}

/**
 * Helper: Get all active rules
 *
 * @param {Graph} graph - The graph instance
 * @returns {Array<string>} Array of rule IDs
 */
export function getActiveRules(graph) {
  const results = graph.query(["?rule", "memberOf", "rule", "system"]);
  return results
    .map(b => b.get("?rule"))
    .filter(ruleId => {
      // Exclude rules that have been deactivated (have tombstone edge)
      const tombstoneQ = graph.query([ruleId, "memberOf", "rule", "tombstone"]);
      return tombstoneQ.length === 0;
    });
}

/**
 * Helper: Get rule definition
 *
 * @param {Graph} graph - The graph instance
 * @param {string} ruleId - Rule ID
 * @returns {Object} { matchQuads, produceQuads, nacQuads }
 */
export function getRuleDefinition(graph, ruleId) {
  const matchQuads = graph.query([ruleId, "matches", "?q", "*"])
    .map(b => b.get("?q"));

  const produceQuads = graph.query([ruleId, "produces", "?q", "*"])
    .map(b => b.get("?q"));

  const nacQuads = graph.query([ruleId, "nac", "?q", "*"])
    .map(b => b.get("?q"));

  return {
    matchQuads,
    produceQuads,
    nacQuads,
  };
}

/**
 * Helper: Check how many times a rule has fired
 *
 * @param {Graph} graph - The graph instance
 * @param {string} ruleId - Rule ID
 * @returns {number} Number of firings
 */
export function getRuleFirings(graph, ruleId) {
  const results = graph.query([ruleId, "FIRED", "?timestamp", "system"]);
  return results.length;
}
