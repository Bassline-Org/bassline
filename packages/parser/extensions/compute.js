/**
 * Compute Extension
 *
 * Enables actual computation through pattern-triggered calculations.
 * Watches for compute request patterns and writes results back as edges.
 *
 * Example:
 *   fact [compute:1 { op add x 5 y 10 }]
 *   → compute:1 result 15
 */

/**
 * Install compute watchers on a graph
 */
export function installCompute(graph) {
  // Watch for binary arithmetic operations
  graph.watch([["?C", "op", "?OP"]], (bindings) => {
    const computeId = bindings.get("?C");
    const op = bindings.get("?OP");

    // Check if this compute request was already processed
    const existingResults = graph.query([computeId, "result", "?R"]);
    if (existingResults.length > 0) {
      return; // Already computed
    }

    // Get operands
    const xResults = graph.query([computeId, "x", "?X"]);
    const yResults = graph.query([computeId, "y", "?Y"]);

    if (xResults.length > 0 && yResults.length > 0) {
      const x = xResults[0].get("?X");
      const y = yResults[0].get("?Y");

      // Convert to numbers if they're not already
      const xNum = typeof x === 'number' ? x : parseFloat(x);
      const yNum = typeof y === 'number' ? y : parseFloat(y);

      if (!isNaN(xNum) && !isNaN(yNum)) {
        let result;

        // Perform operation
        switch (op.toString().toLowerCase()) {
          case 'add':
          case '+':
            result = xNum + yNum;
            break;
          case 'subtract':
          case 'sub':
          case '-':
            result = xNum - yNum;
            break;
          case 'multiply':
          case 'mult':
          case '*':
            result = xNum * yNum;
            break;
          case 'divide':
          case 'div':
          case '/':
            result = yNum !== 0 ? xNum / yNum : NaN;
            break;
          case 'mod':
          case '%':
            result = xNum % yNum;
            break;
          case 'pow':
          case '^':
            result = Math.pow(xNum, yNum);
            break;
          default:
            return; // Unknown operation
        }

        if (!isNaN(result)) {
          // Write result back to graph
          graph.add(computeId, "result", result);
          graph.add(computeId, "computed-at", Date.now());
        }
      }
    }
  });

  // Watch for unary operations
  graph.watch([["?C", "op", "?OP"], ["?C", "value", "?V"]], (bindings) => {
    const computeId = bindings.get("?C");
    const op = bindings.get("?OP");
    const value = bindings.get("?V");

    // Check if already computed
    const existingResults = graph.query([computeId, "result", "?R"]);
    if (existingResults.length > 0) {
      return;
    }

    const num = typeof value === 'number' ? value : parseFloat(value);
    if (!isNaN(num)) {
      let result;

      switch (op.toString().toLowerCase()) {
        case 'sqrt':
          result = Math.sqrt(num);
          break;
        case 'abs':
          result = Math.abs(num);
          break;
        case 'floor':
          result = Math.floor(num);
          break;
        case 'ceil':
          result = Math.ceil(num);
          break;
        case 'round':
          result = Math.round(num);
          break;
        case 'neg':
        case 'negate':
          result = -num;
          break;
        default:
          return;
      }

      if (!isNaN(result)) {
        graph.add(computeId, "result", result);
        graph.add(computeId, "computed-at", Date.now());
      }
    }
  });

  // Watch for comparison operations
  graph.watch([["?C", "compare", "?OP"]], (bindings) => {
    const computeId = bindings.get("?C");
    const op = bindings.get("?OP");

    // Check if already computed
    const existingResults = graph.query([computeId, "result", "?R"]);
    if (existingResults.length > 0) {
      return;
    }

    const leftResults = graph.query([computeId, "left", "?L"]);
    const rightResults = graph.query([computeId, "right", "?R"]);

    if (leftResults.length > 0 && rightResults.length > 0) {
      const left = leftResults[0].get("?L");
      const right = rightResults[0].get("?R");

      const leftNum = typeof left === 'number' ? left : parseFloat(left);
      const rightNum = typeof right === 'number' ? right : parseFloat(right);

      let result;

      switch (op.toString().toLowerCase()) {
        case 'gt':
        case '>':
          result = leftNum > rightNum;
          break;
        case 'lt':
        case '<':
          result = leftNum < rightNum;
          break;
        case 'gte':
        case '>=':
          result = leftNum >= rightNum;
          break;
        case 'lte':
        case '<=':
          result = leftNum <= rightNum;
          break;
        case 'eq':
        case '==':
          result = leftNum === rightNum;
          break;
        case 'neq':
        case '!=':
          result = leftNum !== rightNum;
          break;
        default:
          return;
      }

      graph.add(computeId, "result", result);
      graph.add(computeId, "computed-at", Date.now());
    }
  });

  // Watch for aggregation requests
  graph.watch([["?A", "aggregate", "?OP"]], (bindings) => {
    const aggId = bindings.get("?A");
    const op = bindings.get("?OP");

    // Check if already computed
    const existingResults = graph.query([aggId, "result", "?R"]);
    if (existingResults.length > 0) {
      return;
    }

    // Get items to aggregate
    const itemResults = graph.query([aggId, "item", "?V"]);

    if (itemResults.length > 0) {
      const values = itemResults.map(b => {
        const v = b.get("?V");
        return typeof v === 'number' ? v : parseFloat(v);
      }).filter(v => !isNaN(v));

      if (values.length > 0) {
        let result;

        switch (op.toString().toLowerCase()) {
          case 'sum':
            result = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
          case 'average':
            result = values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case 'min':
            result = Math.min(...values);
            break;
          case 'max':
            result = Math.max(...values);
            break;
          case 'count':
            result = values.length;
            break;
          default:
            return;
        }

        graph.add(aggId, "result", result);
        graph.add(aggId, "computed-at", Date.now());
      }
    }
  });

  return {
    uninstall() {
      // TODO: Keep track of unwatchers and call them here
    }
  };
}

/**
 * Helper to create compute request triples
 */
export function computeRequest(id, op, x, y) {
  return [
    [id, "op", op],
    [id, "x", x],
    [id, "y", y]
  ];
}

/**
 * Helper to create aggregation request
 */
export function aggregateRequest(id, op, values) {
  const triples = [[id, "aggregate", op]];
  for (const value of values) {
    triples.push([id, "item", value]);
  }
  return triples;
}