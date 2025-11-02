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

  // Aggregations - truly incremental
  // Store aggregation state in memory, not in graph (since graph is append-only)
  const aggregationState = new Map();

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

    // Get or initialize state for this aggregation
    const stateKey = aggId;
    if (!aggregationState.has(stateKey)) {
      aggregationState.set(stateKey, {
        sum: 0,
        count: 0,
        min: Infinity,
        max: -Infinity,
        op: op
      });
    }

    const state = aggregationState.get(stateKey);

    // Update state incrementally
    state.sum += num;
    state.count += 1;
    state.min = Math.min(state.min, num);
    state.max = Math.max(state.max, num);

    // Compute and store result based on operation
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

    graph.add(aggId, "RESULT", result);
  });
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