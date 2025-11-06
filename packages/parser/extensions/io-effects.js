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

// Import built-in effects
import { builtinIOEffects } from './io-effects-builtin.js';
import { builtinNodeEffects } from './io-effects-node.js';

/**
 * Install an effect using IO context pattern
 *
 * @param {Graph} graph - The graph instance
 * @param {string} name - Effect name (uppercase recommended)
 * @param {Function} executor - Async function: (graph, ctx) => outputs object
 * @param {object} metadata - Optional metadata (category, docs, etc)
 */
export function installIOEffect(graph, name, executor, metadata = {}) {
  const effectName = name.toUpperCase();

  // Self-describe in graph
  graph.add(effectName, "TYPE", "EFFECT", "system");
  if (metadata.category) {
    graph.add(effectName, "CATEGORY", metadata.category, "system");
  }
  if (metadata.doc) {
    graph.add(effectName, "DOCS", metadata.doc, "system");
  }

  // Mark EFFECT as a type (idempotent)
  graph.add("EFFECT", "TYPE", "TYPE!", "system");

  // Watch for requests in input context
  const unwatch = graph.watch([
    ["?ctx", "handle", effectName, "input"],
  ], async (bindings) => {
    const ctx = bindings.get("?ctx");

    try {
      // Mark as in-progress (optional)
      graph.add(effectName, "processing", ctx, "system");

      // Execute - lets executor query graph for inputs
      const outputs = await executor(graph, ctx);

      // Clear in-progress marker
      graph.add(effectName, "processing", ctx, "tombstone");

      // Write completion marker to output context
      graph.add(effectName, "handled", ctx, "output");

      // Write outputs to output context
      for (const [attr, value] of Object.entries(outputs)) {
        graph.add(ctx, attr, value, "output");
      }
    } catch (error) {
      // Clear in-progress marker
      graph.add(effectName, "processing", ctx, "tombstone");

      // Write error to output context
      graph.add(effectName, "handled", ctx, "output");
      graph.add(ctx, "ERROR", error.message, "output");
      graph.add(ctx, "STATUS", "ERROR", "output");
    }
  });

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
  const results = graph.query([effectName, "processing", ctx, "system"]);
  return results.length > 0;
}

/**
 * Query helper: Get result from output context
 */
export function getOutput(graph, ctx, attr) {
  const results = graph.query([ctx, attr, "?value", "output"]);
  return results.length > 0 ? results[0].get("?value") : null;
}

/**
 * Query helper: Check if effect has handled a context
 */
export function isHandled(graph, effectName, ctx) {
  const results = graph.query([effectName, "handled", ctx, "output"]);
  return results.length > 0;
}

/**
 * Query helper: Find all contexts handled by an effect
 */
export function getHandledContexts(graph, effectName) {
  const results = graph.query([effectName, "handled", "?ctx", "output"]);
  return results.map((b) => b.get("?ctx"));
}

/**
 * Query helper: Find all active effects
 */
export function getActiveEffects(graph) {
  const results = graph.query(["?effect", "TYPE", "EFFECT", "system"]);
  return results.map((b) => b.get("?effect"));
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

/**
 * Install all built-in Node.js effects (filesystem)
 *
 * @param {Graph} graph - The graph instance
 * @returns {Map} Map of effect names to unwatch functions
 */
export function installNodeEffects(graph) {
  return installIOEffects(graph, builtinNodeEffects);
}

/**
 * Install ALL built-in effects (browser + Node.js)
 *
 * @param {Graph} graph - The graph instance
 * @returns {Map} Map of effect names to unwatch functions
 */
export function installAllEffects(graph) {
  const browserUnwatchMap = installBuiltinEffects(graph);
  const nodeUnwatchMap = installNodeEffects(graph);

  // Merge maps
  return new Map([...browserUnwatchMap, ...nodeUnwatchMap]);
}

// Re-export built-in definitions
export { builtinIOEffects, builtinNodeEffects };
