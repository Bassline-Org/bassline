/**
 * Interactive Runtime
 *
 * Minimal wrapper over existing pattern-based language infrastructure.
 * Provides:
 * - Single-word shorthand expansion (alice → query [alice * *])
 * - Convenient eval() interface
 * - Persistence and serialization
 * - Built-in extensions (compute, aggregation, effects)
 */

import { Graph } from "./minimal-graph.js";
import { parseProgram } from "./pattern-parser.js";
import { createContext, executeProgram } from "./pattern-words.js";
import { installBuiltinCompute } from "../extensions/io-compute.js";
import {
  builtinAggregations,
  installReifiedAggregations,
} from "../extensions/aggregation/index.js";
import { installBuiltinEffects } from "../extensions/io-effects.js";
import {
  getActiveRules as getReifiedActiveRules,
  installReifiedRules,
} from "../extensions/reified-rules.js";
// Note: Persistence and connections require Node.js modules (fs, ws)
// For Node environments, use io-effects-all.js instead
// import { installAllPersistence } from "../extensions/io-effects-persistence.js";
// import { installConnectionEffects } from "../extensions/io-effects-connections.js";

export class Runtime {
  constructor() {
    this.graph = new Graph();
    this.context = createContext(this.graph);

    // Install extensions
    installReifiedRules(this.graph, this.context);
    installBuiltinCompute(this.graph);
    installReifiedAggregations(this.graph, builtinAggregations, this.context);
    installBuiltinEffects(this.graph); // Browser-compatible effects only

    // Time-travel: eval history is the source of truth
    // Replaying history recreates all state (edges, patterns, rules, aggregations)
    this.evalHistory = [];
    this.checkpoints = new Map();
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
    // Execute and track in history
    const result = this._executeEval(source);
    this.evalHistory.push(source);
    return result;
  }

  /**
   * Internal eval for replay (doesn't add to history)
   * @private
   */
  _executeEval(source) {
    // Handle single-word shorthand: alice → query where { alice ?attr ?target * }
    const trimmed = source.trim();
    if (this.isSingleWord(trimmed)) {
      source = `query where { ${trimmed} ?attr ?target * }`;
    }

    // Parse and execute using existing infrastructure
    const ast = parseProgram(source);
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
    // Match: word, word-with-dashes, word:with:colons, word!
    // But not: patterns with spaces, brackets, or other syntax
    return /^[a-zA-Z_][a-zA-Z0-9_:!-]*$/.test(source);
  }

  /**
   * Convenience: Execute a query
   * @param {string} patterns - Query patterns (without "query where {...}" wrapper)
   * @returns {Array<Map>} Variable bindings
   */
  query(patterns) {
    return this.eval(`query where { ${patterns} }`);
  }

  /**
   * Convenience: Add facts
   * @param {string} triples - Fact triples (without "insert {...}" wrapper)
   * @returns {Array<number>} Edge IDs
   */
  fact(triples) {
    return this.eval(`insert { ${triples} }`);
  }

  /**
   * Reset the runtime - clear graph and unwatches all patterns/rules
   */
  reset() {
    this.context.cleanup();
    this.graph = new Graph();
    this.context = createContext(this.graph);

    // Reinstall extensions to restore self-describing metadata
    installReifiedRules(this.graph, this.context);
    installBuiltinCompute(this.graph);
    installReifiedAggregations(this.graph, builtinAggregations, this.context);
    installBuiltinEffects(this.graph); // Browser-compatible effects only
  }

  /**
   * Serialize the graph to JSON
   * @returns {Object} Serialized graph state
   */
  toJSON() {
    return {
      edges: this.graph.edges.map((e) => ({
        source: e.source,
        attr: e.attr,
        target: e.target,
      })),
    };
  }

  /**
   * Restore graph from JSON
   * @param {Object} data - Serialized graph state
   */
  fromJSON(data) {
    this.reset();
    if (data.edges) {
      data.edges.forEach((e) => {
        this.graph.add(e.source, e.attr, e.target, e.context);
      });
    }
  }

  /**
   * Get all active patterns
   * @returns {Array<string>} Pattern names
   */
  getActivePatterns() {
    // Named patterns are stored in context.namedPatterns
    if (!this.context.namedPatterns) {
      return [];
    }
    return Array.from(this.context.namedPatterns.keys());
  }

  /**
   * Get all active rules
   * @returns {Array<string>} Rule names
   */
  getActiveRules() {
    return getReifiedActiveRules(this.graph);
  }

  /**
   * Get graph statistics
   * @returns {Object} Graph stats
   */
  getStats() {
    return {
      edges: this.graph.edges.length,
      patterns: this.context.patterns.size,
      rules: this.context.rules.size,
    };
  }

  /**
   * Create a checkpoint of current state
   * @param {string} name - Checkpoint name (defaults to timestamp)
   * @returns {Object} Checkpoint metadata
   */
  checkpoint(name = `auto-${Date.now()}`) {
    const cp = {
      name,
      historyIndex: this.evalHistory.length,
      timestamp: Date.now(),
    };
    this.checkpoints.set(name, cp);
    return cp;
  }

  /**
   * Restore to a named checkpoint
   * @param {string} name - Checkpoint name
   */
  restore(name) {
    const cp = this.checkpoints.get(name);
    if (!cp) {
      throw new Error(`Checkpoint not found: ${name}`);
    }

    // Reset to fresh state
    this.reset();

    // Truncate history to checkpoint
    const historyToReplay = this.evalHistory.slice(0, cp.historyIndex);
    this.evalHistory = [];

    // Replay commands up to checkpoint
    historyToReplay.forEach((cmd) => {
      this._executeEval(cmd);
      this.evalHistory.push(cmd);
    });

    // Restore checkpoint metadata
    this.checkpoints = new Map();
    this.checkpoints.set(name, cp);
  }

  /**
   * Undo last N commands
   * @param {number} count - Number of commands to undo (default 1)
   */
  undo(count = 1) {
    if (count > this.evalHistory.length) {
      throw new Error(`Can only undo ${this.evalHistory.length} command(s)`);
    }

    // Truncate history
    const historyToReplay = this.evalHistory.slice(0, -count);
    this.evalHistory = [];

    // Reset and replay
    this.reset();
    historyToReplay.forEach((cmd) => {
      this._executeEval(cmd);
      this.evalHistory.push(cmd);
    });

    // Clear checkpoints (they're now invalid)
    this.checkpoints.clear();
  }

  /**
   * List all checkpoints
   * @returns {Array<Object>} Checkpoint metadata sorted by timestamp
   */
  listCheckpoints() {
    return Array.from(this.checkpoints.values())
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get recent command history
   * @param {number} count - Number of commands to return (default 10)
   * @returns {Array<string>} Recent commands
   */
  getHistory(count = 10) {
    return this.evalHistory.slice(-count);
  }
}
