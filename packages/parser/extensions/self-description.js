/**
 * Self-Description Extension
 *
 * Makes the graph fully introspectable and serializable.
 * Patterns and rules register themselves as triples, enabling:
 * - Serialization/deserialization of entire system state
 * - Querying the graph about its own structure
 * - Meta-programming capabilities
 */

import { parsePattern } from "../src/pattern-parser.js";
import { createContext, executeCommand } from "../src/pattern-words.js";

/**
 * Serialize a graph to JSON
 * Captures all edges including pattern/rule definitions
 */
export function serialize(graph) {
  return JSON.stringify({
    edges: graph.edges.map(e => ({
      source: e.source,
      attr: e.attr,
      target: e.target
    })),
    timestamp: Date.now()
  }, null, 2);
}

/**
 * Deserialize JSON back into a graph
 *
 * Simply restores edges - patterns and rules will self-activate
 * if the system has meta-rules watching for pattern/rule definitions.
 */
export function deserialize(json, graph, context) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;

  // Clear existing state
  graph.edges = [];
  if (context) {
    context.cleanup();
  }

  // Restore edges - that's it!
  // If meta-rules are installed, patterns/rules will auto-activate
  for (const edge of data.edges) {
    graph.add(edge.source, edge.attr, edge.target);
  }

  return graph;
}

/**
 * Install meta-rules that auto-activate patterns and rules
 * This makes the system truly self-describing
 */
export function installMetaRules(graph, context) {
  // Meta-rule: When we see a pattern definition, create the pattern
  graph.watch([["?P", "type", "pattern"], ["?P", "status", "active"]], (bindings) => {
    const patternId = bindings.get("?P");

    // Check if already installed
    const name = patternId.replace("pattern:", "");
    if (context.patterns && context.patterns.has(name)) {
      return;
    }

    // Get pattern spec
    const matchResults = graph.query([patternId, "match", "?M"]);
    if (matchResults.length > 0) {
      const match = JSON.parse(matchResults[0].get("?M"));
      const nacResults = graph.query([patternId, "nac", "?N"]);
      const nac = nacResults.length > 0 ? JSON.parse(nacResults[0].get("?N")) : [];

      // Create the pattern
      const command = {
        type: "pattern",
        name: name.toUpperCase(),
        patterns: match,
        nac: nac
      };

      executeCommand(graph, command, context);
    }
  });

  // Meta-rule: When we see a rule definition, create the rule
  graph.watch([["?R", "type", "rule"], ["?R", "status", "active"]], (bindings) => {
    const ruleId = bindings.get("?R");

    // Check if already installed
    const name = ruleId.replace("rule:", "");
    if (context.rules && context.rules.has(name)) {
      return;
    }

    // Get rule spec
    const matchResults = graph.query([ruleId, "match", "?M"]);
    const produceResults = graph.query([ruleId, "produce", "?P"]);

    if (matchResults.length > 0 && produceResults.length > 0) {
      const match = JSON.parse(matchResults[0].get("?M"));
      const produce = JSON.parse(produceResults[0].get("?P"));

      const matchNacResults = graph.query([ruleId, "match-nac", "?MN"]);
      const matchNac = matchNacResults.length > 0 ? JSON.parse(matchNacResults[0].get("?MN")) : [];

      const produceNacResults = graph.query([ruleId, "produce-nac", "?PN"]);
      const produceNac = produceNacResults.length > 0 ? JSON.parse(produceNacResults[0].get("?PN")) : [];

      // Create the rule
      const command = {
        type: "rule",
        name: name.toUpperCase(),
        match: match,
        matchNac: matchNac,
        produce: produce,
        produceNac: produceNac
      };

      executeCommand(graph, command, context);
    }
  });
}

/**
 * Save graph to file (Node.js environment)
 */
export async function saveToFile(graph, filename) {
  if (typeof window !== 'undefined') {
    // Browser environment - download as file
    const json = serialize(graph);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    // Node.js environment
    const fs = await import('fs/promises');
    await fs.writeFile(filename, serialize(graph));
  }
}

/**
 * Load graph from file (Node.js environment)
 */
export async function loadFromFile(filename, graph, context) {
  if (typeof window !== 'undefined') {
    throw new Error("File loading not supported in browser. Use file input instead.");
  } else {
    const fs = await import('fs/promises');
    const json = await fs.readFile(filename, 'utf-8');
    return deserialize(json, graph, context);
  }
}

/**
 * Get metadata about the graph's self-description
 */
export function getMetadata(graph) {
  const patterns = graph.query(["?P", "type", "pattern"]);
  const rules = graph.query(["?R", "type", "rule"]);
  const activePatterns = graph.query(["?P", "status", "active"]);
  const activeRules = graph.query(["?R", "status", "active"]);

  return {
    totalEdges: graph.edges.length,
    patterns: patterns.length,
    rules: rules.length,
    activePatterns: activePatterns.filter(b =>
      b.get("?P").startsWith("pattern:")).length,
    activeRules: activeRules.filter(b =>
      b.get("?R").startsWith("rule:")).length,
    canSerialize: true,
    canIntrospect: true
  };
}