/**
 * Pattern Words - Runtime for pattern DSL
 *
 * Takes the simple quad arrays from pattern-parser.js
 * and executes them using the minimal-graph.js engine.
 *
 * Like parser.js words, this provides the semantics for our parsed structures.
 */

import { resolve } from "./minimal-graph.js";

/**
 * Create execution context for patterns and rules
 */
export function createContext(graph) {
  return {
    graph,
    patterns: new Map(),
    rules: new Map(),
    cleanup() {
      // Unwatch all patterns and rules
      this.patterns.forEach(p => p.unwatch && p.unwatch());
      this.rules.forEach(r => r.unwatch && r.unwatch());
      this.patterns.clear();
      this.rules.clear();
    },
  };
}

// ============================================================================
// Compatibility Shim: Parser AST → Runtime Format
// ============================================================================

/**
 * Unwrap parser value objects to raw values
 * Temporary compatibility layer - proper type handling TBD
 */
function unwrap(val) {
  if (val === null) return null;
  if (typeof val === 'object') {
    if (val.word) return val.word;
    if (val.number !== undefined) return val.number;
    if (val.string !== undefined) return val.string;
    if (val.patternVar) return `?${val.patternVar}`;
    if (val.wildcard) return "*";
  }
  return val;
}

/**
 * Unwrap a quad (4-tuple with wrapped values)
 */
function unwrapQuad([e, a, v, c]) {
  return [unwrap(e), unwrap(a), unwrap(v), unwrap(c)];
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
      const patternName = unwrap(quad.patternRef);
      const stored = context.namedPatterns?.get(patternName);
      if (stored) {
        expanded.push(...stored);
      } else {
        throw new Error(`Pattern not found: ${patternName}`);
      }
    } else {
      expanded.push(unwrapQuad(quad));
    }
  }
  return expanded;
}

/**
 * Normalize parser AST to runtime command format
 * Handles: insert→fact, unwrapping values, expanding pattern refs, storing named patterns
 */
function normalizeCommand(cmd, context = {}) {
  if (cmd.insert) {
    return {
      type: "fact",
      triples: expandPatternRefs(cmd.insert, context)
    };
  }

  if (cmd.query) {
    return {
      type: "query",
      patterns: expandPatternRefs(cmd.query.where, context),
      nac: expandPatternRefs(cmd.query.not, context)
    };
  }

  if (cmd.rule) {
    return {
      type: "rule",
      name: unwrap(cmd.rule.name),
      match: expandPatternRefs(cmd.rule.where, context),
      matchNac: expandPatternRefs(cmd.rule.not, context),
      produce: expandPatternRefs(cmd.rule.produce, context),
      produceNac: []
    };
  }

  if (cmd.pattern) {
    // Store pattern for later reference (not executed, just stored)
    const name = unwrap(cmd.pattern.name);
    const quads = cmd.pattern.patterns.map(unwrapQuad);
    if (!context.namedPatterns) context.namedPatterns = new Map();
    context.namedPatterns.set(name, quads);
    return null; // Don't execute, just store
  }

  return cmd; // Already normalized
}

// ============================================================================
// Command Execution
// ============================================================================

/**
 * Execute a command from the parser
 * Commands work directly with quad arrays: [source, attr, target, context]
 */
export function executeCommand(graph, command, context = {}) {
  switch (command.type) {
    case "fact": {
      // Insert quads into the graph
      const results = [];
      for (const [source, attr, target, ctx] of command.triples) {
        results.push(graph.add(source, attr, target, ctx));
      }
      return results;
    }

    case "query": {
      // Query with triple patterns and optional NAC
      if (command.nac && command.nac.length > 0) {
        return graph.query({ patterns: command.patterns, nac: command.nac });
      } else {
        return graph.query(...command.patterns);
      }
    }

    case "rule": {
      // Rule: match patterns trigger produce patterns with optional NAC
      const matchSpec = command.matchNac && command.matchNac.length > 0
        ? { patterns: command.match, nac: command.matchNac }
        : command.match;

      const unwatch = graph.watch(matchSpec, (bindings) => {
        // Apply the rewrite - resolve variables in produce patterns
        for (const [s, a, t, c] of command.produce) {
          const source = resolve(s, bindings);
          const attr = resolve(a, bindings);
          const target = resolve(t, bindings);
          const ctx = c ? resolve(c, bindings) : null;
          graph.add(source, attr, target, ctx);
        }

        // Record rule firing
        graph.add(command.name, "FIRED", Date.now(), "system");
      });

      // Register rule as quads for self-description
      graph.add(command.name, "TYPE", "RULE!", "system");
      graph.add(command.name, "MATCH", JSON.stringify(command.match), "system");
      if (command.matchNac && command.matchNac.length > 0) {
        graph.add(command.name, "MATCH-NAC", JSON.stringify(command.matchNac), "system");
      }
      graph.add(command.name, "PRODUCE", JSON.stringify(command.produce), "system");
      if (command.produceNac && command.produceNac.length > 0) {
        graph.add(command.name, "PRODUCE-NAC", JSON.stringify(command.produceNac), "system");
      }
      graph.add(command.name, "STATUS", "ACTIVE", "system");

      // Mark RULE! as a type (idempotent)
      graph.add("RULE!", "TYPE", "TYPE!", "system");

      // Store in context
      if (!context.rules) context.rules = new Map();
      context.rules.set(command.name, {
        match: command.match,
        matchNac: command.matchNac || [],
        produce: command.produce,
        produceNac: command.produceNac || [],
        unwatch
      });

      return command.name;
    }

    case "clear": {
      // Clear graph
      graph.edges = [];
      if (context.patterns) {
        context.patterns.forEach(p => p.unwatch && p.unwatch());
        context.patterns.clear();
      }
      if (context.rules) {
        context.rules.forEach(r => r.unwatch && r.unwatch());
        context.rules.clear();
      }
      return "CLEARED";
    }

    default:
      throw new Error(`Unknown command type: ${command.type}`);
  }
}

/**
 * Execute a program (list of commands)
 * Normalizes parser AST and executes commands
 */
export function executeProgram(graph, program, context = {}) {
  // Handle both array format (from parser) and wrapped format
  const commands = Array.isArray(program) ? program : program.commands;

  const results = [];
  for (const command of commands) {
    // Normalize parser AST to runtime format
    const normalized = normalizeCommand(command, context);

    // Skip null (stored patterns don't execute, just store)
    if (normalized) {
      results.push(executeCommand(graph, normalized, context));
    }
  }
  return results;
}