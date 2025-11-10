/**
 * IO-Based Effects
 *
 * Effects implemented using input/output system contexts.
 * Uses graph-native IO pattern with handle/handled coordination.
 *
 * Pattern:
 * 1. Create context with input data:
 *    graph.add("req1", "MESSAGE", "Hello", null);
 * 2. Request handling:
 *    graph.add("req1", "handle", "LOG", "input");
 * 3. Effect executes and writes to output:
 *    graph.add("LOG", "handled", "req1", "output");
 *    graph.add("req1", "LOGGED", "TRUE", "output");
 *
 * Built-in effects:
 * - Browser: LOG, ERROR, WARN, HTTP_GET, HTTP_POST
 * - Node.js: READ_FILE, WRITE_FILE, APPEND_FILE
 */

// Import built-in effects (browser-safe only)
import { builtinIOEffects } from "./io-effects-builtin.js";
import { quad as q } from "../src/algebra/quad.js";
import {
  matchGraph,
  pattern as pat,
  patternQuad as pq,
} from "../src/algebra/pattern.js";
import { variable as v, WC, word as w } from "../src/types.js";

/**
 * Helper: Get input value from context
 *
 * @param {Graph} graph - The graph instance
 * @param {Word} ctx - Context to query
 * @param {string} attr - Attribute to get
 * @param {Word} context - Context filter (default: WC)
 * @returns {*} Value or undefined
 */
export function getInput(graph, ctx, attr, context = WC) {
  const results = matchGraph(graph, pat(pq(ctx, w(attr), v("val"), context)));
  return results[0]?.get("val");
}

/**
 * Install an effect using IO context pattern
 *
 * @param {Graph} graph - The graph instance
 * @param {string} name - Effect name (uppercase recommended)
 * @param {Function} executor - Async function: (graph, ctx) => outputs object
 * @param {object} metadata - Optional metadata (category, docs, etc)
 */
export function installIOEffect(graph, name, executor, metadata = {}) {
  const effectName = w(name);

  // Self-describe in graph
  graph.add(q(effectName, w("type"), w("effect!"), w("system")));
  if (metadata.category) {
    graph.add(q(effectName, w("category"), metadata.category, w("system")));
  }
  if (metadata.doc) {
    graph.add(q(effectName, w("docs"), metadata.doc, w("system")));
  }

  // Mark EFFECT as a type (idempotent)
  graph.add(q(w("effect!"), w("type"), w("type!"), w("system")));

  // Watch for requests in input context
  const unwatch = graph.watch(
    {
      pattern: pat(pq(
        v("ctx"),
        w("handle"),
        effectName,
        w("input"),
      )),
      production: (bindings) => {
        const ctx = bindings.get("ctx");

        Promise.resolve(executor(graph, ctx)).then((outputs) => {
          graph.add(q(ctx, w("status"), w("SUCCESS"), w("output")));
          Object.entries(outputs).forEach(([attr, value]) => {
            graph.add(q(ctx, w(attr), value, w("output")));
          });
          graph.add(q(effectName, w("handled"), ctx, w("output")));
        }).catch((error) => {
          graph.add(q(ctx, w("error"), error.message, w("output")));
          graph.add(q(ctx, w("status"), w("error"), w("output")));
          graph.add(q(effectName, w("handled"), ctx, w("output")));
        });
        return [
          q(effectName, w("processing"), ctx, w("system")),
        ];
      },
    },
  );
  return unwatch;
}

/**
 * Install multiple effects at once
 *
 * @param {Graph} graph - The graph instance
 * @param {Object} effects - Nested object: { category: { name: { execute, doc } } }
 * @returns {Map} Map of effect names to unwatch functions
 */
export function installIOEffects(graph, effects) {
  const unwatchMap = new Map();

  for (const [category, categoryEffects] of Object.entries(effects)) {
    for (const [name, def] of Object.entries(categoryEffects)) {
      const unwatch = installIOEffect(graph, name, def.execute, {
        category,
        doc: def.doc,
      });
      unwatchMap.set(name.toUpperCase(), unwatch);
    }
  }

  return unwatchMap;
}

/**
 * Query helper: Check if effect is processing a context
 */
export function isProcessing(graph, effectName, ctx) {
  const results = matchGraph(
    graph,
    pat(pq(effectName, w("processing"), ctx, w("system"))),
  );
  return results.length > 0;
}

/**
 * Query helper: Get result from output context
 */
export function getOutput(graph, ctx, attr) {
  const results = matchGraph(
    graph,
    pat(pq(ctx, attr, v("value"), w("output"))),
  );
  return results[0]?.get("value");
}

/**
 * Query helper: Check if effect has handled a context
 */
export function isHandled(graph, effectName, ctx) {
  const results = matchGraph(
    graph,
    pat(pq(effectName, w("handled"), ctx, w("output"))),
  );
  return results.length > 0;
}

/**
 * Query helper: Find all contexts handled by an effect
 */
export function getHandledContexts(graph, effectName) {
  return matchGraph(
    graph,
    pat(pq(effectName, w("handled"), v("ctx"), w("output"))),
  ).map((b) => b.get("ctx"));
}

/**
 * Query helper: Find all active effects
 */
export function getActiveEffects(graph) {
  const results = matchGraph(
    graph,
    pat(pq(v("effect"), w("type"), w("effect!"), w("system"))),
  );
  return results.map((b) => b.get("effect"));
}

/**
 * Install all built-in browser effects
 *
 * @param {Graph} graph - The graph instance
 * @returns {Map} Map of effect names to unwatch functions
 */
export function installBuiltinEffects(graph) {
  return installIOEffects(graph, builtinIOEffects);
}

// Re-export built-in definitions
export { builtinIOEffects };
