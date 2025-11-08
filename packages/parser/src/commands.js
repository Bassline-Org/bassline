/**
 * Command classes for Bassline pattern language
 *
 * Commands represent parsed operations that can be executed against a graph.
 * Each command encapsulates its data and execution logic.
 */

import { resolve } from "./minimal-graph.js";
import { match } from "./types.js";

/**
 * Convert quad to pattern string for reified rules
 * Example: [Word("ALICE"), Word("TYPE"), Word("PERSON"), null] → "ALICE TYPE PERSON *"
 */
function quadToString([s, a, t, c]) {
  const parts = [s, a, t, c === null ? "*" : c];
  return parts.map((p) => {
    if (p === null) return "*";
    if (typeof p === "string") return p;
    if (typeof p === "number") return String(p);
    // Handle typed values (Word, PatternVar, etc.)
    return match(p, {
      word: (spelling) => spelling,
      variable: (name) => `?${name}`,
      wildcard: () => "*",
      string: (str) => str,
      number: (num) => String(num),
    });
  }).join(" ");
}

/**
 * Expand pattern references (<name>) inline to stored quads
 * Pattern references are like macros - they inject the stored quad list
 */
function expandPatternRefs(quads, context) {
  const expanded = [];
  for (const quad of quads) {
    if (quad.patternRef) {
      // Inline expansion: <name> → stored quads
      const patternName = quad.patternRef;
      const stored = context.namedPatterns?.get(patternName);
      if (stored) {
        expanded.push(...stored);
      } else {
        throw new Error(`Pattern not found: ${patternName}`);
      }
    } else {
      expanded.push(quad);
    }
  }
  return expanded;
}

// ============================================================================
// Base Command Class
// ============================================================================

/**
 * Base class for all commands
 */
export class Command {
  /**
   * Execute this command against a graph
   * @param {Graph} graph - The graph to execute against
   * @param {Object} context - Execution context (patterns, rules, namedPatterns)
   * @returns {*} Command-specific result
   */
  execute(graph, context) {
    throw new Error("Command.execute() must be implemented by subclass");
  }

  /**
   * Get command type name (for debugging/introspection)
   */
  get type() {
    return this.constructor.name;
  }
}

// ============================================================================
// Concrete Command Classes
// ============================================================================

/**
 * InsertCommand - Insert quads into the graph
 *
 * Corresponds to: insert { ... }
 */
export class InsertCommand extends Command {
  constructor(triples, context = {}) {
    super();
    this.triples = expandPatternRefs(triples, context);
  }

  execute(graph, context) {
    const results = [];
    graph.batch(() => {
      for (const [source, attr, target, ctx] of this.triples) {
        results.push(graph.add(source, attr, target, ctx));
      }
    });
    return results;
  }
}

/**
 * QueryCommand - Query with pattern matching and optional produce
 *
 * Corresponds to: query where { ... } [not { ... }] [produce { ... }]
 */
export class QueryCommand extends Command {
  constructor(querySpec, context = {}) {
    super();
    this.patterns = expandPatternRefs(querySpec.where || [], context);
    this.nac = expandPatternRefs(querySpec.not || [], context);
    this.produce = expandPatternRefs(querySpec.produce || [], context);
  }

  execute(graph, context) {
    // Query with optional NAC
    const results = this.nac.length > 0
      ? graph.query({ patterns: this.patterns, nac: this.nac })
      : graph.query(...this.patterns);

    // Handle produce clause (SQL-style insert on query)
    if (this.produce.length > 0) {
      results.forEach((bindings) => {
        this.produce.forEach(([s, a, t, c]) => {
          const resolvedQuad = [
            resolve(s, bindings),
            resolve(a, bindings),
            resolve(t, bindings),
            resolve(c, bindings),
          ];
          graph.add(...resolvedQuad);
        });
      });
    }

    return results;
  }
}

/**
 * RuleCommand - Create reified rule (graph-native storage & activation)
 *
 * Corresponds to: rule name where { ... } produce { ... }
 */
export class RuleCommand extends Command {
  constructor(ruleSpec, context = {}) {
    super();
    this.name = ruleSpec.name;
    this.match = expandPatternRefs(ruleSpec.where || [], context);
    this.matchNac = expandPatternRefs(ruleSpec.not || [], context);
    this.produce = expandPatternRefs(ruleSpec.produce || [], context);
  }

  execute(graph, context) {
    // Emit reified rule structure as edges
    graph.add(this.name, "TYPE", "RULE!", "system");

    // Emit match patterns as strings
    for (const matchQuad of this.match) {
      graph.add(
        this.name,
        "matches",
        quadToString(matchQuad),
        this.name,
      );
    }

    // Emit NAC patterns if present
    if (this.matchNac.length > 0) {
      for (const nacQuad of this.matchNac) {
        graph.add(
          this.name,
          "nac",
          quadToString(nacQuad),
          this.name,
        );
      }
    }

    // Emit produce patterns
    for (const produceQuad of this.produce) {
      graph.add(
        this.name,
        "produces",
        quadToString(produceQuad),
        this.name,
      );
    }

    // Activate rule via system context
    graph.add(this.name, "memberOf", "rule", "system");

    return this.name;
  }
}

/**
 * ClearCommand - Reset the graph and all patterns/rules
 *
 * Corresponds to: clear-graph
 */
export class ClearCommand extends Command {
  execute(graph, context) {
    // Clear all edges
    graph.edges = [];

    // Unwatch all patterns
    if (context.patterns) {
      context.patterns.forEach((p) => p.unwatch && p.unwatch());
      context.patterns.clear();
    }

    // Unwatch all rules
    if (context.rules) {
      context.rules.forEach((r) => r.unwatch && r.unwatch());
      context.rules.clear();
    }

    return "CLEARED";
  }
}
