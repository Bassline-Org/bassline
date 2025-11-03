/**
 * Pattern Words - Runtime for pattern DSL
 *
 * Takes the simple triple arrays from pattern-parser.js
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

/**
 * Execute a command from the parser
 * Commands work directly with triple arrays: [source, attr, target]
 */
export function executeCommand(graph, command, context = {}) {
  switch (command.type) {
    case "fact": {
      // Insert triples into the graph
      const results = [];
      for (const [source, attr, target] of command.triples) {
        results.push(graph.add(source, attr, target));
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

    case "pattern": {
      // Named pattern for watching with optional NAC
      const spec = command.nac && command.nac.length > 0
        ? { patterns: command.patterns, nac: command.nac }
        : command.patterns;

      const unwatch = graph.watch(spec, (bindings) => {
        // Record match in graph
        const matchId = `MATCH:${Date.now()}:${Math.random()}`;
        graph.add(command.name, "MATCHED", matchId);

        // Store bindings
        bindings.forEach((value, varName) => {
          graph.add(matchId, varName, value);
        });
      });

      // Register pattern as triples for self-description
      graph.add(command.name, "TYPE", "PATTERN!");
      graph.add(command.name, "MATCH", JSON.stringify(command.patterns));
      if (command.nac && command.nac.length > 0) {
        graph.add(command.name, "NAC", JSON.stringify(command.nac));
      }
      graph.add(command.name, "STATUS", "ACTIVE");

      // Mark PATTERN! as a type (idempotent)
      graph.add("PATTERN!", "TYPE", "TYPE!");

      // Store in context
      if (!context.patterns) context.patterns = new Map();
      context.patterns.set(command.name, {
        patterns: command.patterns,
        nac: command.nac || [],
        unwatch
      });

      return command.name;
    }

    case "rule": {
      // Rule: match patterns trigger produce patterns with optional NAC
      const matchSpec = command.matchNac && command.matchNac.length > 0
        ? { patterns: command.match, nac: command.matchNac }
        : command.match;

      const unwatch = graph.watch(matchSpec, (bindings) => {
        // Apply the rewrite - resolve variables in produce patterns
        for (const [s, a, t] of command.produce) {
          const source = resolve(s, bindings);
          const attr = resolve(a, bindings);
          const target = resolve(t, bindings);
          graph.add(source, attr, target);
        }

        // Record rule firing
        graph.add(command.name, "FIRED", Date.now());
      });

      // Register rule as triples for self-description
      graph.add(command.name, "TYPE", "RULE!");
      graph.add(command.name, "MATCH", JSON.stringify(command.match));
      if (command.matchNac && command.matchNac.length > 0) {
        graph.add(command.name, "MATCH-NAC", JSON.stringify(command.matchNac));
      }
      graph.add(command.name, "PRODUCE", JSON.stringify(command.produce));
      if (command.produceNac && command.produceNac.length > 0) {
        graph.add(command.name, "PRODUCE-NAC", JSON.stringify(command.produceNac));
      }
      graph.add(command.name, "STATUS", "ACTIVE");

      // Mark RULE! as a type (idempotent)
      graph.add("RULE!", "TYPE", "TYPE!");

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

    case "watch": {
      // Watch: match patterns trigger action patterns with optional NAC
      const matchSpec = command.matchNac && command.matchNac.length > 0
        ? { patterns: command.match, nac: command.matchNac }
        : command.match;

      const unwatch = graph.watch(matchSpec, (bindings) => {
        // Execute action patterns with bindings
        for (const [s, a, t] of command.action) {
          const source = resolve(s, bindings);
          const attr = resolve(a, bindings);
          const target = resolve(t, bindings);
          graph.add(source, attr, target);
        }

        // Record watch firing
        graph.add("watch", "MATCHED", true);
      });

      return { unwatch };
    }

    case "delete": {
      // Delete: create tombstone for triple
      const [source, attr, target] = command.triple;
      const tombstoneId = `TOMBSTONE-${Date.now()}-${Math.random()}`;
      graph.add(tombstoneId, "TYPE", "TOMBSTONE!");
      graph.add(tombstoneId, "SOURCE", source);
      graph.add(tombstoneId, "ATTR", attr);
      graph.add(tombstoneId, "TARGET", target);

      // Mark TOMBSTONE! as a type (idempotent)
      graph.add("TOMBSTONE!", "TYPE", "TYPE!");

      return tombstoneId;
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

    case "info": {
      // Graph info
      const activePatterns = Array.from(context.patterns || []).filter(
        ([_, p]) => p.unwatch
      ).length;
      const activeRules = Array.from(context.rules || []).filter(
        ([_, r]) => r.unwatch
      ).length;

      return {
        edges: graph.edges.length,
        patterns: context.patterns ? context.patterns.size : 0,
        activePatterns,
        activeRules,
      };
    }

    default:
      throw new Error(`Unknown command type: ${command.type}`);
  }
}

/**
 * Execute a program (list of commands)
 */
export function executeProgram(graph, program, context = {}) {
  if (program.type !== "program") {
    throw new Error(`Expected program, got ${program.type}`);
  }

  const results = [];
  for (const command of program.commands) {
    results.push(executeCommand(graph, command, context));
  }
  return results;
}