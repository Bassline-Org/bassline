/**
 * Minimal Graph Runtime
 *
 * Everything is incremental pattern matching over an append-only log.
 * No indexes, no query builders - just patterns watching edges.
 */

// ============================================================================
// Phase 1: Core Data Structure (The Log)
// ============================================================================

export class Graph {
  constructor() {
    this.edges = [];      // Append-only log of edges
    this.patterns = [];   // Active patterns watching for matches
    this.nextId = 0;      // Sequential edge IDs for rollback
    this.inBatch = false; // Are we in a batch transaction?
    this.batchEdges = []; // Edges accumulated during batch
  }

  /**
   * Add an edge to the graph
   * @param {*} source - Source node
   * @param {*} attr - Attribute/relation
   * @param {*} target - Target node/value
   * @returns {number} Edge ID
   */
  add(source, attr, target) {
    const edge = { source, attr, target, id: this.nextId++ };

    if (this.inBatch) {
      // Accumulate in batch, don't update patterns yet
      this.batchEdges.push(edge);
    } else {
      // Immediate mode - add and update patterns
      this.edges.push(edge);
      this.updatePatterns(edge);
    }

    return edge.id;
  }

  /**
   * Update all active patterns with a new edge
   * @private
   */
  updatePatterns(edge) {
    for (const pattern of this.patterns) {
      pattern.update(edge);
    }
  }

  /**
   * Execute a function with batched edge additions
   * All edges commit together or rollback on error
   */
  batch(fn) {
    const checkpoint = this.nextId;
    const edgeCountBefore = this.edges.length;
    this.inBatch = true;
    this.batchEdges = [];

    try {
      // Execute the batch function
      fn();

      // Commit all batched edges
      for (const edge of this.batchEdges) {
        this.edges.push(edge);
        this.updatePatterns(edge);
      }

      this.batchEdges = [];
      this.inBatch = false;
      return true;
    } catch (error) {
      // Rollback: remove any edges added after checkpoint
      this.edges = this.edges.slice(0, edgeCountBefore);
      this.nextId = checkpoint;
      this.batchEdges = [];
      this.inBatch = false;

      // Reset all pattern states
      for (const pattern of this.patterns) {
        pattern.reset();
        // Replay all remaining edges through the pattern
        for (const edge of this.edges) {
          pattern.update(edge);
        }
      }

      throw error;
    }
  }
}

// ============================================================================
// Phase 2: Pattern Matching Engine
// ============================================================================

export class Pattern {
  constructor(spec) {
    this.spec = spec;           // [[s,a,t], ...] pattern specification
    this.partial = new Map();   // Map<edgeId, PartialMatch>
    this.complete = [];         // Array<CompleteMatch>
    this.onComplete = null;     // Callback when pattern matches
  }

  /**
   * Reset pattern state (used during rollback)
   */
  reset() {
    this.partial.clear();
    this.complete = [];
  }

  /**
   * Process a new edge, updating partial/complete matches
   */
  update(edge) {
    // Try to extend existing partial matches
    const toAdd = [];
    const toRemove = [];

    for (const [id, partial] of this.partial) {
      const extended = this.tryExtend(partial, edge);
      if (extended) {
        if (extended.isComplete) {
          this.complete.push(extended);
          toRemove.push(id);
          // Fire callback if registered
          if (this.onComplete) {
            this.onComplete(extended.bindings);
          }
        } else {
          // Add extended partial as new entry
          toAdd.push([`${id}-${edge.id}`, extended]);
        }
      }
      // Keep original partial too (it might match with different future edges)
    }

    // Apply removals
    for (const id of toRemove) {
      this.partial.delete(id);
    }

    // Apply additions
    for (const [id, partial] of toAdd) {
      this.partial.set(id, partial);
    }

    // Try to start new match with this edge
    const started = this.tryStart(edge);
    if (started) {
      if (started.isComplete) {
        this.complete.push(started);
        if (this.onComplete) {
          this.onComplete(started.bindings);
        }
      } else {
        this.partial.set(`start-${edge.id}`, started);
      }
    }
  }

  /**
   * Try to start a new match with the given edge
   */
  tryStart(edge) {
    for (let i = 0; i < this.spec.length; i++) {
      const [s, a, t] = this.spec[i];
      const bindings = new Map();

      if (this.matches(edge, s, a, t, bindings)) {
        return {
          matched: [i],
          bindings,
          edges: [edge],
          isComplete: this.spec.length === 1
        };
      }
    }
    return null;
  }

  /**
   * Try to extend a partial match with a new edge
   */
  tryExtend(partial, edge) {
    for (let i = 0; i < this.spec.length; i++) {
      // Skip already matched positions
      if (partial.matched.includes(i)) continue;

      const [s, a, t] = this.spec[i];
      const bindings = new Map(partial.bindings);

      if (this.matches(edge, s, a, t, bindings)) {
        const matched = [...partial.matched, i];
        return {
          matched,
          bindings,
          edges: [...partial.edges, edge],
          isComplete: matched.length === this.spec.length
        };
      }
    }
    return null;
  }

  /**
   * Check if an edge matches a pattern triple with variable binding
   */
  matches(edge, s, a, t, bindings) {
    return this.matchField(edge.source, s, bindings) &&
           this.matchField(edge.attr, a, bindings) &&
           this.matchField(edge.target, t, bindings);
  }

  /**
   * Match a single field with variable binding support
   */
  matchField(value, pattern, bindings) {
    // Wildcard matches anything
    if (pattern === "*" || pattern === null || pattern === undefined) {
      return true;
    }

    // Variable binding
    if (typeof pattern === "string" && pattern.startsWith("?")) {
      if (bindings.has(pattern)) {
        // Variable already bound - check consistency
        return bindings.get(pattern) === value;
      } else {
        // New variable - create binding
        bindings.set(pattern, value);
        return true;
      }
    }

    // Literal match
    return pattern === value;
  }
}

// ============================================================================
// Phase 3: High-Level API (Added to Graph class)
// ============================================================================

// Add these methods to the Graph class
Object.assign(Graph.prototype, {
  /**
   * One-shot query - find all current matches
   * @param {...Array} spec - Pattern specification
   * @returns {Array<Map>} Array of variable bindings
   */
  query(...spec) {
    const pattern = new Pattern(spec);

    // Process all existing edges
    for (const edge of this.edges) {
      pattern.update(edge);
    }

    // Return bindings from complete matches
    return pattern.complete.map(match => match.bindings);
  },

  /**
   * Watch for pattern matches (persistent)
   * @param {Array} spec - Pattern specification
   * @param {Function} onMatch - Callback for matches
   * @returns {Function} Unwatch function
   */
  watch(spec, onMatch) {
    const pattern = new Pattern(spec);
    pattern.onComplete = onMatch;

    // Process existing edges
    for (const edge of this.edges) {
      pattern.update(edge);
    }

    // Register for future updates
    this.patterns.push(pattern);

    // Return unwatch function
    return () => {
      const idx = this.patterns.indexOf(pattern);
      if (idx >= 0) {
        this.patterns.splice(idx, 1);
      }
    };
  }
});

// ============================================================================
// Phase 5: Graph Rewriting Helpers
// ============================================================================

/**
 * Create a rewrite function that transforms bindings into new edges
 * Can be called with or without explicit graph parameter
 */
export function rewrite(match, produce, graph) {
  return (bindings, g) => {
    const targetGraph = g || graph;
    if (!targetGraph) {
      throw new Error("rewrite requires a graph instance");
    }
    for (const [s, a, t] of produce) {
      const source = resolve(s, bindings);
      const attr = resolve(a, bindings);
      const target = resolve(t, bindings);
      targetGraph.add(source, attr, target);
    }
  };
}

/**
 * Resolve a value that might be a variable
 */
export function resolve(value, bindings) {
  if (typeof value === "string" && value.startsWith("?")) {
    return bindings.get(value) !== undefined ? bindings.get(value) : value;
  }
  return value;
}

// ============================================================================
// Exports
// ============================================================================

export default Graph;