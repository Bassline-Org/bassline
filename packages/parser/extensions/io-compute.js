/**
 * IO-Based Compute
 *
 * Compute operations implemented using input/output system contexts.
 * Uses graph-native IO pattern with handle/handled coordination.
 *
 * Pattern:
 * 1. Create context with operands:
 *    graph.add("calc1", "X", 10, null);
 *    graph.add("calc1", "Y", 20, null);
 * 2. Request computation:
 *    graph.add("calc1", "handle", "ADD", "input");
 * 3. Operation executes and writes to output:
 *    graph.add("ADD", "handled", "calc1", "output");
 *    graph.add("calc1", "RESULT", 30, "output");
 *
 * Built-in operations:
 * - Binary: ADD, SUBTRACT, MULTIPLY, DIVIDE, MOD, POW
 * - Unary: SQRT, ABS, FLOOR, CEIL, ROUND, NEGATE
 * - Comparison: GT, LT, GTE, LTE, EQ, NEQ
 */

// Import built-in operations
import { builtinIOOperations } from './io-compute-builtin.js';
import { getInput } from './io-effects.js';

/**
 * Parse number from value (handles strings and numbers)
 */
function parseNum(val) {
  if (typeof val === "number") return val;
  const num = parseFloat(val);
  return isNaN(num) ? NaN : num;
}

/**
 * Install a compute operation using IO context pattern
 *
 * @param {Graph} graph - The graph instance
 * @param {string} name - Operation name (e.g., "ADD", "MULTIPLY")
 * @param {Function} compute - Function: (operands) => result
 * @param {object} metadata - Optional metadata (type, arity, docs, etc)
 */
export function installIOCompute(graph, name, compute, metadata = {}) {
  const opName = name.toUpperCase();

  // Self-describe in graph
  graph.add(opName, "TYPE", "OPERATION", "system");
  if (metadata.arity) {
    graph.add(opName, "ARITY", metadata.arity, "system");
  }
  if (metadata.operationType) {
    graph.add(opName, "OPERATION-TYPE", metadata.operationType, "system");
  }
  if (metadata.doc) {
    graph.add(opName, "DOCS", metadata.doc, "system");
  }

  // Mark OPERATION as a type (idempotent)
  graph.add("OPERATION", "TYPE", "TYPE!", "system");

  // Determine expected attributes based on arity
  const attrs = metadata.arity === "binary"
    ? ["x", "y"]
    : metadata.arity === "unary"
    ? ["value"]
    : metadata.arity === "comparison"
    ? ["left", "right"]
    : ["x", "y"]; // Default to binary

  // Watch for requests in input context
  const unwatch = graph.watch([
    ["?ctx", "handle", opName, "input"],
  ], (bindings) => {
    const ctx = bindings.get("?ctx");

    try {
      // Query context for operands
      const operands = {};
      for (const attr of attrs) {
        const value = getInput(graph, ctx, attr.toUpperCase());
        if (value === undefined) {
          throw new Error(`Missing operand: ${attr}`);
        }
        operands[attr] = parseNum(value);
        if (isNaN(operands[attr])) {
          throw new Error(`Invalid number for ${attr}`);
        }
      }

      // Compute result
      const result = metadata.arity === "unary"
        ? compute(operands.value)
        : metadata.arity === "comparison"
        ? compute(operands.left, operands.right)
        : compute(operands.x, operands.y);

      // Write result to output context FIRST
      graph.add(ctx, "RESULT", result, "output");
      graph.add(ctx, "STATUS", "SUCCESS", "output");

      // Write completion marker LAST (so watchers see complete output)
      graph.add(opName, "handled", ctx, "output");
    } catch (error) {
      // Write error to output context FIRST
      graph.add(ctx, "ERROR", error.message, "output");
      graph.add(ctx, "STATUS", "ERROR", "output");

      // Write completion marker LAST (so watchers see complete output)
      graph.add(opName, "handled", ctx, "output");
    }
  });

  return unwatch;
}

/**
 * Install multiple operations at once
 *
 * @param {Graph} graph - The graph instance
 * @param {Object} operations - Nested object: { type: { name: { compute, doc } } }
 * @returns {Map} Map of operation names to unwatch functions
 */
export function installIOComputeOps(graph, operations) {
  const unwatchMap = new Map();

  for (const [opType, ops] of Object.entries(operations)) {
    for (const [name, def] of Object.entries(ops)) {
      const unwatch = installIOCompute(graph, name, def.compute, {
        arity: opType, // "binary", "unary", "comparison"
        operationType: opType,
        doc: def.doc,
      });
      unwatchMap.set(name.toUpperCase(), unwatch);
    }
  }

  return unwatchMap;
}

/**
 * Query helper: Get result from output context
 */
export function getComputeResult(graph, ctx) {
  return getInput(graph, ctx, "RESULT", "output");
}

/**
 * Query helper: Check if computation is complete
 */
export function isComputed(graph, opName, ctx) {
  const results = graph.query([opName, "handled", ctx, "output"]);
  return results.length > 0;
}

/**
 * Query helper: Find all contexts computed by an operation
 */
export function getComputedContexts(graph, opName) {
  const results = graph.query([opName, "handled", "?ctx", "output"]);
  return results.map((b) => b.get("?ctx"));
}

/**
 * Query helper: Find all active operations
 */
export function getActiveOperations(graph) {
  const results = graph.query(["?op", "TYPE", "OPERATION", "system"]);
  return results.map((b) => b.get("?op"));
}

/**
 * Install all built-in compute operations
 *
 * @param {Graph} graph - The graph instance
 * @returns {Map} Map of operation names to unwatch functions
 */
export function installBuiltinCompute(graph) {
  return installIOComputeOps(graph, builtinIOOperations);
}

// Re-export built-in definitions
export { builtinIOOperations };
