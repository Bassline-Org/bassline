/**
 * Self-Description V2 - Pure Watcher-Based
 *
 * No queries, just watchers that react to pattern/rule definitions
 * and automatically activate them.
 */

import { executeCommand } from "../src/pattern-words.js";

/**
 * Install meta-watchers that make the system self-describing
 * These watchers activate patterns/rules when they see their definitions
 */
export function installSelfDescription(graph, context) {
  // Watch for pattern definitions and auto-activate them
  graph.watch([
    ["?P", "type", "pattern", "*"],
    ["?P", "match", "?M", "*"],
    ["?P", "status", "active", "*"],
  ], (bindings) => {
    const patternId = bindings.get("?P");
    const matchSpec = bindings.get("?M");

    // Extract name from pattern ID
    const name = patternId.replace("pattern:", "");

    // Skip if already active
    if (context.patterns && context.patterns.has(name)) {
      return;
    }

    // Parse the match spec and create pattern
    const match = JSON.parse(matchSpec);

    // Check for NAC (will be added by separate watcher if present)
    // This is handled by composition of watchers

    const command = {
      type: "pattern",
      name: name.toUpperCase(),
      patterns: match,
      nac: [], // NAC will be filled by NAC watcher
    };

    executeCommand(graph, command, context);
  });

  // Separate watcher for patterns with NAC
  graph.watch([
    ["?P", "type", "pattern", "*"],
    ["?P", "match", "?M", "*"],
    ["?P", "nac", "?N", "*"],
    ["?P", "status", "active", "*"],
  ], (bindings) => {
    const patternId = bindings.get("?P");
    const matchSpec = bindings.get("?M");
    const nacSpec = bindings.get("?N");

    const name = patternId.replace("pattern:", "");

    // Skip if already active
    if (context.patterns && context.patterns.has(name)) {
      return;
    }

    const command = {
      type: "pattern",
      name: name.toUpperCase(),
      patterns: JSON.parse(matchSpec),
      nac: JSON.parse(nacSpec),
    };

    executeCommand(graph, command, context);
  });

  // Watch for rule definitions (without NAC)
  graph.watch([
    ["?R", "type", "rule", "*"],
    ["?R", "match", "?M", "*"],
    ["?R", "produce", "?P", "*"],
    ["?R", "status", "active", "*"],
  ], (bindings) => {
    const ruleId = bindings.get("?R");
    const matchSpec = bindings.get("?M");
    const produceSpec = bindings.get("?P");

    const name = ruleId.replace("rule:", "");

    // Skip if already active
    if (context.rules && context.rules.has(name)) {
      return;
    }

    const command = {
      type: "rule",
      name: name.toUpperCase(),
      match: JSON.parse(matchSpec),
      matchNac: [],
      produce: JSON.parse(produceSpec),
      produceNac: [],
    };

    executeCommand(graph, command, context);
  });

  // Watch for rules with match NAC
  graph.watch([
    ["?R", "type", "rule", "*"],
    ["?R", "match", "?M", "*"],
    ["?R", "match-nac", "?MN", "*"],
    ["?R", "produce", "?P", "*"],
    ["?R", "status", "active", "*"],
  ], (bindings) => {
    const ruleId = bindings.get("?R");
    const name = ruleId.replace("rule:", "");

    if (context.rules && context.rules.has(name)) {
      return;
    }

    const command = {
      type: "rule",
      name: name.toUpperCase(),
      match: JSON.parse(bindings.get("?M")),
      matchNac: JSON.parse(bindings.get("?MN")),
      produce: JSON.parse(bindings.get("?P")),
      produceNac: [],
    };

    executeCommand(graph, command, context);
  });

  // Watch for deactivation
  graph.watch([
    ["?P", "status", "inactive", "*"],
  ], (bindings) => {
    const id = bindings.get("?P");

    if (id.startsWith("pattern:")) {
      const name = id.replace("pattern:", "");
      const pattern = context.patterns?.get(name);
      if (pattern && pattern.unwatch) {
        pattern.unwatch();
        context.patterns.delete(name);
      }
    } else if (id.startsWith("rule:")) {
      const name = id.replace("rule:", "");
      const rule = context.rules?.get(name);
      if (rule && rule.unwatch) {
        rule.unwatch();
        context.rules.delete(name);
      }
    }
  });
}

/**
 * Serialize - just dump edges, no queries needed
 */
export function serialize(graph) {
  return JSON.stringify(
    {
      edges: graph.edges.map((e) => ({
        source: e.source,
        attr: e.attr,
        target: e.target,
        context: e.context,
      })),
      timestamp: Date.now(),
    },
    null,
    2,
  );
}

/**
 * Deserialize - just restore edges, watchers auto-activate everything
 */
export function deserialize(json, graph, context) {
  const data = typeof json === "string" ? JSON.parse(json) : json;

  // Clear and restore
  graph.edges = [];
  if (context) {
    context.cleanup();
  }

  // Restore edges - watchers will handle the rest
  for (const edge of data.edges) {
    graph.add(edge.source, edge.attr, edge.target, edge.context);
  }

  return graph;
}

/**
 * Install bootstrap watcher that sets up other extensions
 * This watcher activates when it sees extension definitions
 */
export function installBootstrap(graph) {
  // Watch for extension requests
  graph.watch([
    ["?EXT", "type", "extension", "*"],
    ["?EXT", "name", "?NAME", "*"],
    ["?EXT", "status", "active", "*"],
  ], (bindings) => {
    const name = bindings.get("?NAME");

    // This is where we'd dynamically load and install extensions
    // For now, just mark it as loaded
    graph.add(bindings.get("?EXT"), "loaded", true, "system");
    graph.add(bindings.get("?EXT"), "loaded-at", Date.now(), "system");
  });

  // Watch for aspect dependencies
  graph.watch([
    ["?A", "requires", "?B", "*"],
  ], (bindings) => {
    const aspectA = bindings.get("?A");
    const aspectB = bindings.get("?B");

    // Ensure B is loaded before A
    graph.add(`dependency:${aspectA}:${aspectB}`, "type", "dependency", "system");
    graph.add(`dependency:${aspectA}:${aspectB}`, "from", aspectA, "system");
    graph.add(`dependency:${aspectA}:${aspectB}`, "to", aspectB, "system");
  });
}
