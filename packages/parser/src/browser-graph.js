/**
 * Browser-Compatible Graph Factory
 *
 * Creates a WatchedGraph with all browser-compatible extensions pre-installed.
 * Excludes Node.js-specific extensions (filesystem, persistence, WebSocket server).
 *
 * Installed Extensions:
 * - Reified Rules: Graph-native rule storage and activation
 * - IO Compute: 18 math operations (ADD, SUBTRACT, MULTIPLY, DIVIDE, SQRT, etc.)
 * - IO Effects: Console logging (LOG, ERROR, WARN) + HTTP (HTTP_GET, HTTP_POST)
 *
 * Usage:
 *   import { createBrowserGraph } from '@bassline/parser/browser';
 *   const { graph, events } = createBrowserGraph();
 *
 *   // Use compute operations
 *   graph.add(q(w("calc1"), w("x"), 10, w("calc1")));
 *   graph.add(q(w("calc1"), w("y"), 20, w("calc1")));
 *   graph.add(q(w("calc1"), w("handle"), w("add"), w("input")));
 *   // Result: graph.query for calc1 result in output context
 *
 *   // Use console logging
 *   graph.add(q(w("req1"), w("MESSAGE"), "Hello World", w("req1")));
 *   graph.add(q(w("req1"), w("handle"), w("LOG"), w("input")));
 */

import { WatchedGraph } from "./algebra/watch.js";
import { instrument } from "./algebra/instrument.js";
import { installReifiedRules } from "./algebra/reified-rules.js";
import { installBuiltinCompute } from "../extensions/io-compute.js";
import { installBuiltinEffects } from "../extensions/io-effects.js";

/**
 * Create a fully-featured browser graph with all compatible extensions
 *
 * @returns {{ graph: WatchedGraph, events: EventEmitter }}
 */
export function createBrowserGraph() {
  const graph = new WatchedGraph();
  const events = instrument(graph);

  // Install reified rules (graph-native rule storage & activation)
  installReifiedRules(graph);

  // Install IO compute operations (18 math operations)
  // Binary: add, subtract, multiply, divide, modulo, pow
  // Unary: sqrt, abs, floor, ceil, round, negate
  installBuiltinCompute(graph);

  // Install IO effects (console logging + HTTP)
  // Console: LOG, ERROR, WARN
  // HTTP: HTTP_GET, HTTP_POST
  installBuiltinEffects(graph);

  return { graph, events };
}

// Re-export types and utilities for convenience
export { WatchedGraph } from "./algebra/watch.js";
export { instrument } from "./algebra/instrument.js";
