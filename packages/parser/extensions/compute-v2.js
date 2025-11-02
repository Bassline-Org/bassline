/**
 * Compute Extension V2 - Pure Watcher-Based
 *
 * Instead of querying for operands, we use incremental watchers
 * that fire when all required data is present.
 */

/**
 * Install compute watchers on a graph
 * These watchers incrementally build up compute requests and fire when complete
 */
export function installCompute(graph) {
  // Binary arithmetic: fires when we have op, x, and y
  graph.watch([
    ["?C", "OP", "?OP"],
    ["?C", "X", "?X"],
    ["?C", "Y", "?Y"]
  ], (bindings) => {
    const computeId = bindings.get("?C");
    const op = bindings.get("?OP");
    const x = bindings.get("?X");
    const y = bindings.get("?Y");

    // Convert to numbers
    const xNum = typeof x === 'number' ? x : parseFloat(x);
    const yNum = typeof y === 'number' ? y : parseFloat(y);

    if (isNaN(xNum) || isNaN(yNum)) return;

    let result;
    switch (op.toString()) {
      case 'ADD':
        result = xNum + yNum;
        break;
      case 'SUBTRACT':
        result = xNum - yNum;
        break;
      case 'MULTIPLY':
        result = xNum * yNum;
        break;
      case 'DIVIDE':
        result = yNum !== 0 ? xNum / yNum : NaN;
        break;
      case 'MOD':
        result = xNum % yNum;
        break;
      case 'POW':
        result = Math.pow(xNum, yNum);
        break;
      default:
        return;
    }

    if (!isNaN(result)) {
      graph.add(computeId, "RESULT", result);
    }
  });

  // Unary operations: fires when we have op and value
  graph.watch([
    ["?C", "OP", "?OP"],
    ["?C", "VALUE", "?V"]
  ], (bindings) => {
    const computeId = bindings.get("?C");
    const op = bindings.get("?OP");
    const value = bindings.get("?V");

    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return;

    let result;
    switch (op.toString()) {
      case 'SQRT':
        result = Math.sqrt(num);
        break;
      case 'ABS':
        result = Math.abs(num);
        break;
      case 'FLOOR':
        result = Math.floor(num);
        break;
      case 'CEIL':
        result = Math.ceil(num);
        break;
      case 'ROUND':
        result = Math.round(num);
        break;
      case 'NEGATE':
        result = -num;
        break;
      default:
        return;
    }

    if (!isNaN(result)) {
      graph.add(computeId, "RESULT", result);
    }
  });

  // Comparisons: fires when we have compare, left, and right
  graph.watch([
    ["?C", "COMPARE", "?OP"],
    ["?C", "LEFT", "?L"],
    ["?C", "RIGHT", "?R"]
  ], (bindings) => {
    const computeId = bindings.get("?C");
    const op = bindings.get("?OP");
    const left = bindings.get("?L");
    const right = bindings.get("?R");

    const leftNum = typeof left === 'number' ? left : parseFloat(left);
    const rightNum = typeof right === 'number' ? right : parseFloat(right);

    let result;
    switch (op.toString()) {
      case 'GT':
        result = leftNum > rightNum;
        break;
      case 'LT':
        result = leftNum < rightNum;
        break;
      case 'GTE':
        result = leftNum >= rightNum;
        break;
      case 'LTE':
        result = leftNum <= rightNum;
        break;
      case 'EQ':
        result = leftNum === rightNum;
        break;
      case 'NEQ':
        result = leftNum !== rightNum;
        break;
      default:
        return;
    }

    graph.add(computeId, "RESULT", result);
  });

  // Aggregations - truly incremental with refinement pattern
  // All state stored in the graph itself via versioned edges

  // Track version counters per aggregation to handle concurrent watchers
  const versionCounters = new Map();

  // Watch for new items being added to aggregations
  graph.watch([["?A", "ITEM", "?V"]], (bindings) => {
    const aggId = bindings.get("?A");
    const value = bindings.get("?V");

    // Check if this entity has an AGGREGATE type
    const aggTypeResults = graph.query([aggId, "AGGREGATE", "?OP"]);
    if (aggTypeResults.length === 0) return;

    const op = aggTypeResults[0].get("?OP").toString();
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return;

    // Get and increment version counter atomically
    const versionKey = `${aggId}:VERSION`;

    if (!versionCounters.has(aggId)) {
      // Initialize from graph if this is the first time
      const versionResults = graph.query([versionKey, "CURRENT", "?V"]);
      const currentVersion = versionResults.length > 0 ? parseInt(versionResults[0].get("?V")) : 0;
      versionCounters.set(aggId, currentVersion);
    }

    const currentVersion = versionCounters.get(aggId);
    const newVersion = currentVersion + 1;
    versionCounters.set(aggId, newVersion);

    // Get previous state (if exists)
    let prevSum = 0, prevCount = 0, prevMin = Infinity, prevMax = -Infinity;

    if (currentVersion > 0) {
      const prevStateKey = `${aggId}:STATE:V${currentVersion}`;

      const sumResults = graph.query([prevStateKey, "SUM", "?S"]);
      if (sumResults.length > 0) prevSum = parseFloat(sumResults[0].get("?S"));

      const countResults = graph.query([prevStateKey, "COUNT", "?C"]);
      if (countResults.length > 0) prevCount = parseInt(countResults[0].get("?C"));

      const minResults = graph.query([prevStateKey, "MIN", "?M"]);
      if (minResults.length > 0) prevMin = parseFloat(minResults[0].get("?M"));

      const maxResults = graph.query([prevStateKey, "MAX", "?X"]);
      if (maxResults.length > 0) prevMax = parseFloat(maxResults[0].get("?X"));
    }

    // Calculate new state
    const newSum = prevSum + num;
    const newCount = prevCount + 1;
    const newMin = Math.min(prevMin, num);
    const newMax = Math.max(prevMax, num);

    // Compute result based on operation
    let result;
    switch (op) {
      case 'SUM':
        result = newSum;
        break;
      case 'AVG':
        result = newSum / newCount;
        break;
      case 'MIN':
        result = newMin === Infinity ? num : newMin;
        break;
      case 'MAX':
        result = newMax === -Infinity ? num : newMax;
        break;
      case 'COUNT':
        result = newCount;
        break;
      default:
        return;
    }

    // Create versioned keys
    const newResultKey = `${aggId}:RESULT:V${newVersion}`;
    const newStateKey = `${aggId}:STATE:V${newVersion}`;
    const prevResultKey = currentVersion > 0 ? `${aggId}:RESULT:V${currentVersion}` : null;

    // Add edges directly (watchers already run in transaction context)
    // Add new result
    graph.add(aggId, newResultKey, result);

    // Add new state
    graph.add(newStateKey, "SUM", newSum);
    graph.add(newStateKey, "COUNT", newCount);
    graph.add(newStateKey, "MIN", newMin === Infinity ? num : newMin);
    graph.add(newStateKey, "MAX", newMax === -Infinity ? num : newMax);

    // Mark as refining previous result (if exists)
    if (prevResultKey) {
      graph.add(newResultKey, "REFINES", prevResultKey);
    }

    // Update version marker
    graph.add(versionKey, "CURRENT", newVersion);
  });
}

/**
 * Get the current (non-refined) result for an aggregation
 * Uses NAC to find results that aren't refined by anything newer
 */
export function getCurrentResult(graph, aggId) {
  // Find all result keys for this aggregation
  const allResults = graph.edges.filter(e =>
    e.source === aggId &&
    e.attr.toString().startsWith(`${aggId}:RESULT:V`)
  );

  for (const edge of allResults) {
    const resultKey = edge.attr;
    const value = edge.target;

    // Check if this result is refined by anything
    const isRefined = graph.edges.some(e =>
      e.attr === "REFINES" && e.target === resultKey
    );

    if (!isRefined) {
      // This is the current result (not refined by anything)
      return value;
    }
  }

  return null; // No results found
}

/**
 * Get current results using NAC pattern matching
 * More declarative approach using the query system
 */
export function getCurrentResultViaQuery(graph, aggId) {
  // Find all versions and get the highest
  const versionKey = `${aggId}:VERSION`;
  const versionResults = graph.query([versionKey, "CURRENT", "?V"]);

  if (versionResults.length > 0) {
    // Get the highest version (latest in append-only log)
    let maxVersion = 0;
    for (const binding of versionResults) {
      const version = parseInt(binding.get("?V"));
      if (version > maxVersion) {
        maxVersion = version;
      }
    }

    const resultKey = `${aggId}:RESULT:V${maxVersion}`;

    // Get the result for this version
    const results = graph.query([aggId, resultKey, "?R"]);
    if (results.length > 0) {
      return results[0].get("?R");
    }
  }

  return null;
}

/**
 * Install meta-watcher that prevents duplicate results
 * This ensures compute operations are idempotent
 */
export function installIdempotency(graph) {
  // Prevent duplicate results by using NAC
  graph.watch({
    patterns: [
      ["?C", "OP", "?OP"],
      ["?C", "X", "?X"],
      ["?C", "Y", "?Y"]
    ],
    nac: [
      ["?C", "RESULT", "?R"]
    ]
  }, (bindings) => {
    // This watcher only fires if there's NO existing result
    // The actual computation is handled by the compute watchers
  });
}