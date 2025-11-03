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

  // Track aggregation state and watchers
  const aggregationStates = new Map();
  const aggregationWatchers = new Map();

  // When an AGGREGATE edge is added, set up a specific watcher for that aggregation's items
  graph.watch([["?A", "AGGREGATE", "?OP"]], (bindings) => {
    const aggId = bindings.get("?A");
    const op = bindings.get("?OP").toString();

    // Skip if we already have a watcher for this aggregation
    if (aggregationWatchers.has(aggId)) {
      return;
    }

    // Initialize state for this aggregation
    aggregationStates.set(aggId, {
      version: 0,
      sum: 0,
      count: 0,
      min: Infinity,
      max: -Infinity,
      op: op
    });

    // Set up a specific watcher for THIS aggregation's items
    const unwatch = graph.watch([[aggId, "ITEM", "?V"]], (itemBindings) => {
      const value = itemBindings.get("?V");
      const num = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(num)) return;

      // Get current state for this specific aggregation
      const state = aggregationStates.get(aggId);

      // Update version
      state.version++;
      const newVersion = state.version;

      // Update state
      state.sum += num;
      state.count++;
      state.min = Math.min(state.min, num);
      state.max = Math.max(state.max, num);

      // Compute result based on operation
      let result;
      switch (op) {
        case 'SUM':
          result = state.sum;
          break;
        case 'AVG':
          result = state.sum / state.count;
          break;
        case 'MIN':
          result = state.min === Infinity ? num : state.min;
          break;
        case 'MAX':
          result = state.max === -Infinity ? num : state.max;
          break;
        case 'COUNT':
          result = state.count;
          break;
        default:
          return;
      }

      // Create versioned keys
      const newResultKey = `${aggId}:RESULT:V${newVersion}`;
      const newStateKey = `${aggId}:STATE:V${newVersion}`;
      const prevResultKey = newVersion > 1 ? `${aggId}:RESULT:V${newVersion - 1}` : null;

      // Add new result
      graph.add(aggId, newResultKey, result);

      // Add new state to graph (for persistence/debugging)
      graph.add(newStateKey, "SUM", state.sum);
      graph.add(newStateKey, "COUNT", state.count);
      graph.add(newStateKey, "MIN", state.min === Infinity ? num : state.min);
      graph.add(newStateKey, "MAX", state.max === -Infinity ? num : state.max);

      // Mark as refining previous result (if exists)
      if (prevResultKey) {
        graph.add(newResultKey, "REFINES", prevResultKey);
      }

      // Update version marker
      const versionKey = `${aggId}:VERSION`;
      graph.add(versionKey, "CURRENT", newVersion);
    });

    // Store the unwatch function so we can clean up if needed
    aggregationWatchers.set(aggId, unwatch);
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