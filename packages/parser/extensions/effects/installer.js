/**
 * Effect Installer
 *
 * Modular installer for side-effecting operations.
 * Uses data-driven definitions and pattern-triggered execution.
 */

import { builtinEffects } from "./definitions.js";

/**
 * Install effect watchers on a graph
 * @param {Object} graph - Graph instance
 * @param {Object} effects - Effect definitions (defaults to builtinEffects)
 */
export function installEffects(graph, effects = builtinEffects) {
  // Create lookup map for fast effect dispatch
  const effectMap = new Map();

  // Register all effects
  for (const [category, categoryEffects] of Object.entries(effects)) {
    for (const [name, def] of Object.entries(categoryEffects)) {
      const effectName = name.toUpperCase();
      effectMap.set(effectName, def);

      // Self-describe in graph
      graph.add(effectName, "TYPE", "EFFECT!");
      graph.add(effectName, "CATEGORY", category);
      graph.add(effectName, "DOCS", def.doc);
    }
  }

  // Mark EFFECT! as a type
  graph.add("EFFECT!", "TYPE", "TYPE!");

  // Effect execution watcher: [?E EFFECT ?NAME] [?E INPUT ?data]
  graph.watch([
    ["?E", "EFFECT", "?NAME"],
    ["?E", "INPUT", "?DATA"],
  ], async (bindings) => {
    const effectId = bindings.get("?E");
    const effectName = bindings.get("?NAME").toString().toUpperCase();
    const inputData = bindings.get("?DATA");

    // Lookup effect
    const effectDef = effectMap.get(effectName);
    if (!effectDef) return;

    try {
      // Execute effect (sync or async, doesn't matter!)
      const result = await effectDef.execute(inputData);

      // Write result to graph when done
      graph.add(effectId, "RESULT", result);
      graph.add(effectId, "STATUS", "SUCCESS");
    } catch (error) {
      // Write error to graph
      graph.add(effectId, "ERROR", error.message);
      graph.add(effectId, "STATUS", "ERROR");
    }
  });
}
