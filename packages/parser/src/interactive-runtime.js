/**
 * Interactive Runtime
 *
 * Minimal wrapper over existing pattern-based language infrastructure.
 * Provides:
 * - Single-word shorthand expansion (alice → query [alice * *])
 * - Convenient eval() interface
 * - Persistence and serialization
 * - Built-in extensions (compute, aggregation)
 */

import { Graph } from './minimal-graph.js';
import { parsePattern } from './pattern-parser.js';
import { createContext, executeProgram } from './pattern-words.js';
import { installCompute } from '../extensions/compute.js';
import { installAggregation, builtinAggregations } from '../extensions/aggregation/index.js';

export class Runtime {
  constructor() {
    this.graph = new Graph();
    this.context = createContext(this.graph);

    // Install extensions
    installCompute(this.graph);
    installAggregation(this.graph, builtinAggregations);
  }

  /**
   * Evaluate a pattern-language expression
   *
   * @param {string} source - Pattern language source code
   * @returns {*} Results from last command executed
   *
   * Single-word shorthand: "alice" expands to "query [alice ?attr ?target]"
   *
   * Result formats (from last command):
   * - fact: Array<number> (edge IDs)
   * - query: Array<Map> (variable bindings)
   * - rule/pattern: string (name)
   * - watch: {unwatch: Function}
   * - graph-info: Object
   * - clear-graph: string
   */
  eval(source) {
    // Handle single-word shorthand: alice → query [alice ?attr ?target]
    const trimmed = source.trim();
    if (this.isSingleWord(trimmed)) {
      source = `query [${trimmed} ?attr ?target]`;
    }

    // Parse and execute using existing infrastructure
    const ast = parsePattern(source);
    const commandResults = executeProgram(this.graph, ast, this.context);

    // executeProgram returns array of results (one per command)
    // Return the last result for convenience
    return commandResults.length > 0
      ? commandResults[commandResults.length - 1]
      : null;
  }

  /**
   * Check if input is a single word (for shorthand expansion)
   * @private
   */
  isSingleWord(source) {
    // Match: word, word-with-dashes, word:with:colons
    // But not: patterns with spaces, brackets, or other syntax
    return /^[a-zA-Z_][a-zA-Z0-9_:-]*$/.test(source);
  }

  /**
   * Convenience: Execute a query
   * @param {string} patterns - Query patterns (without "query [...]" wrapper)
   * @returns {Array<Map>} Variable bindings
   */
  query(patterns) {
    return this.eval(`query [${patterns}]`);
  }

  /**
   * Convenience: Add facts
   * @param {string} triples - Fact triples (without "fact [...]" wrapper)
   * @returns {Array<number>} Edge IDs
   */
  fact(triples) {
    return this.eval(`fact [${triples}]`);
  }

  /**
   * Reset the runtime - clear graph and unwatches all patterns/rules
   */
  reset() {
    this.context.cleanup();
    this.graph = new Graph();
    this.context = createContext(this.graph);

    // Reinstall extensions to restore self-describing metadata
    installCompute(this.graph);
    installAggregation(this.graph, builtinAggregations);
  }

  /**
   * Serialize the graph to JSON
   * @returns {Object} Serialized graph state
   */
  toJSON() {
    return {
      edges: this.graph.edges.map(e => ({
        source: e.source,
        attr: e.attr,
        target: e.target
      }))
    };
  }

  /**
   * Restore graph from JSON
   * @param {Object} data - Serialized graph state
   */
  fromJSON(data) {
    this.reset();
    if (data.edges) {
      data.edges.forEach(e => {
        this.graph.add(e.source, e.attr, e.target);
      });
    }
  }

  /**
   * Get all active patterns
   * @returns {Array<string>} Pattern names
   */
  getActivePatterns() {
    return Array.from(this.context.patterns.keys());
  }

  /**
   * Get all active rules
   * @returns {Array<string>} Rule names
   */
  getActiveRules() {
    return Array.from(this.context.rules.keys());
  }

  /**
   * Get graph statistics
   * @returns {Object} Graph stats
   */
  getStats() {
    return {
      edges: this.graph.edges.length,
      patterns: this.context.patterns.size,
      rules: this.context.rules.size
    };
  }
}
