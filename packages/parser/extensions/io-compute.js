/**
 * IO-Based Compute
 *
 * Compute operations implemented using input/output system contexts.
 * Uses graph-native IO pattern with handle/handled coordination.
 *
 * Pattern:
 * 1. Create context with operands (quads in calc context):
 *    graph.add(q(w("calc1"), w("x"), 10, w("calc1")));
 *    graph.add(q(w("calc1"), w("y"), 20, w("calc1")));
 * 2. Request computation:
 *    graph.add(q(w("calc1"), w("handle"), w("add"), w("input")));
 * 3. Operation executes and writes to output:
 *    graph.add(q(w("add"), w("handled"), w("calc1"), w("output")));
 *    graph.add(q(w("calc1"), w("result"), 30, w("output")));
 *
 * Built-in operations:
 * - Binary: add, subtract, multiply, divide, modulo, pow
 * - Unary: sqrt, abs, floor, ceil, round, negate
 */

// Import built-in operations
import { builtinIOOperations } from "./io-compute-builtin.js";
import { quad as q } from "../src/algebra/quad.js";
import { variable as v, WC, word as w } from "../src/types.js";
import {
  matchGraph,
  pattern as pat,
  patternQuad as pq,
} from "../src/algebra/pattern.js";

/**
 * Install a compute operation using IO context pattern
 *
 * @param {Graph} graph - The graph instance
 * @param {string} name - Operation name (e.g., "ADD", "MULTIPLY")
 * @param {Function} compute - Function: (operands) => result
 * @param {object} metadata - Optional metadata (type, arity, docs, etc)
 */
export function installIOCompute(graph, name, compute, metadata = {}) {
  const opName = w(name);

  const toAdd = [
    q(opName, w("type"), w("operation!"), w("system")),
  ];

  if (metadata.arity) {
    toAdd.push(q(opName, w("arity"), metadata.arity, w("system")));
  }
  if (metadata.operationType) {
    toAdd.push(
      q(opName, w("operation-type"), metadata.operationType, w("system")),
    );
  }
  if (metadata.doc) {
    toAdd.push(q(opName, w("docs"), metadata.doc, w("system")));
  }

  toAdd.push(q(w("operation!"), w("type"), w("type!"), w("system")));

  if (metadata.arity === "unary") {
    toAdd.push(q(opName, w("args"), "x", w("input")));
  } else {
    toAdd.push(q(opName, w("args"), "x y", w("input")));
  }

  for (const quad of toAdd) {
    graph.add(quad);
  }

  const getArgs = metadata.arity === "unary" ? getUnaryArgs : getBinaryArgs;

  // Watch for requests in input context
  const unwatch = graph.watch(
    {
      pattern: pat(pq(
        v("ctx"),
        w("handle"),
        opName,
        w("input"),
      )),
      production: (bindings) => {
        const ctx = bindings.get("ctx");
        try {
          const args = getArgs(graph, ctx);
          const result = compute(...args);
          return [
            q(ctx, w("result"), result, w("output")),
            q(ctx, w("status"), w("SUCCESS"), w("output")),
            q(opName, w("handled"), ctx, w("output")),
          ];
        } catch (error) {
          return [
            q(ctx, w("error"), error.message, w("output")),
            q(ctx, w("status"), w("error"), w("output")),
            q(opName, w("handled"), ctx, w("output")),
          ];
        }
      },
    },
  );
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
  const results = matchGraph(
    graph,
    pat(pq(ctx, w("result"), v("val"), w("output"))),
  );
  return results[0]?.get("val");
}

/**
 * Query helper: Check if computation is complete
 */
export function isComputed(graph, opName, ctx) {
  const results = matchGraph(
    graph,
    pat(pq(
      opName,
      w("handled"),
      ctx,
      w("output"),
    )),
  );
  return results.length > 0;
}

/**
 * Query helper: Find all contexts computed by an operation
 */
export function getComputedContexts(graph, opName) {
  const results = matchGraph(
    graph,
    pat(pq(
      opName,
      w("handled"),
      v("ctx"),
      w("output"),
    )),
  );
  return results.map((b) => b.get("ctx"));
}

/**
 * Query helper: Find all active operations
 */
export function getActiveOperations(graph) {
  const results = matchGraph(
    graph,
    pat(pq(
      v("op"),
      w("type"),
      w("operation!"),
      w("system"),
    )),
  );
  return results.map((b) => b.get("op"));
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

function getUnaryArgs(graph, ctx) {
  let result;
  matchGraph(
    graph,
    pat(pq(
      ctx,
      w("x"),
      v("x"),
      WC,
    )),
  ).forEach((m) => {
    result = [m.get("x")];
  });
  if (result === undefined || result.length === 0) {
    throw new Error(`Missing operand: x`);
  }
  return result;
}

function getBinaryArgs(graph, ctx) {
  let result;
  matchGraph(
    graph,
    pat(
      pq(ctx, w("x"), v("x"), WC),
      pq(ctx, w("y"), v("y"), WC),
    ),
  ).forEach((m) => {
    result = [m.get("x"), m.get("y")];
  });
  if (result === undefined || result.length !== 2) {
    throw new Error(`Missing or invalid operands: x and y`);
  }
  return result;
}

// Re-export built-in definitions
export { builtinIOOperations };
