/**
 * Aggregation Core - Reusable helpers for versioned data and refinement chains
 *
 * These functions work for ANY versioned data, not just aggregations.
 */

/**
 * Add a versioned result with refinement chain
 *
 * @param {Graph} graph - The graph to add to
 * @param {string} entityId - The entity being versioned (e.g., "AGG1")
 * @param {number} version - The version number
 * @param {*} result - The computed result value
 * @param {Object} debugState - Optional state to persist for debugging
 */
export function addVersionedResult(graph, entityId, version, result, debugState = null) {
  const resultKey = `${entityId}:RESULT:V${version}`;
  const prevKey = version > 1 ? `${entityId}:RESULT:V${version - 1}` : null;

  // Add new result
  graph.add(entityId, resultKey, result);

  // Add refinement edge (marks previous version as superseded)
  if (prevKey) {
    graph.add(resultKey, "REFINES", prevKey);
  }

  // Update version marker (for convenience)
  graph.add(`${entityId}:VERSION`, "CURRENT", version);

  // Optional: persist internal state for debugging/inspection
  if (debugState) {
    const stateKey = `${entityId}:STATE:V${version}`;
    Object.entries(debugState).forEach(([key, val]) => {
      graph.add(stateKey, key, val);
    });
  }
}

/**
 * Get the current (non-refined) value for an entity
 * Uses NAC to find values that aren't refined by anything
 *
 * @param {Graph} graph - The graph to query
 * @param {string} entityId - The entity to get current value for
 * @returns {*} The current value, or null if none exists
 */
export function getCurrentValue(graph, entityId) {
  // Query with NAC: find RESULT keys that aren't refined
  const results = graph.query({
    patterns: [[entityId, "?key", "?value"]],
    nac: [["?newer", "REFINES", "?key"]]  // NAC: no newer version refines this
  });

  // Filter to only RESULT keys
  const resultKeys = results.filter(b => {
    const key = b.get("?key").toString();
    return key.startsWith(`${entityId}:RESULT:`);
  });

  // Return the value if found
  return resultKeys.length > 0 ? resultKeys[0].get("?value") : null;
}

/**
 * Get all versions (including historical) for an entity
 *
 * @param {Graph} graph - The graph to query
 * @param {string} entityId - The entity to get versions for
 * @returns {Array} Array of {version, value, isCurrent} objects
 */
export function getAllVersions(graph, entityId) {
  // Get all RESULT edges
  const allResults = graph.query([entityId, "?key", "?value"]);

  const versions = allResults
    .filter(b => b.get("?key").toString().startsWith(`${entityId}:RESULT:V`))
    .map(b => {
      const key = b.get("?key").toString();
      const versionMatch = key.match(/V(\d+)$/);
      const version = versionMatch ? parseInt(versionMatch[1]) : 0;

      // Check if this version is refined
      const refined = graph.query(["?newer", "REFINES", key]);
      const isCurrent = refined.length === 0;

      return {
        version,
        key,
        value: b.get("?value"),
        isCurrent
      };
    })
    .sort((a, b) => a.version - b.version);

  return versions;
}
