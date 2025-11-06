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
    this.edges = []; // Append-only log of edges
    this.patterns = []; // Active patterns watching for matches
    this.nextId = 0; // Sequential edge IDs for rollback
    this.inBatch = false; // Are we in a batch transaction?
    this.batchEdges = []; // Edges accumulated during batch

    // Selective activation indexes
    this.sourceIndex = new Map(); // Map<value, Set<Pattern>>
    this.attrIndex = new Map(); // Map<value, Set<Pattern>>
    this.targetIndex = new Map(); // Map<value, Set<Pattern>>
    this.contextIndex = new Map(); // Map<context, Set<Pattern>>
    this.wildcardPatterns = new Set(); // Patterns with ANY wildcard/variable
  }

  /**
   * Add an edge to the graph
   * @param {*} source - Source node
   * @param {*} attr - Attribute/relation
   * @param {*} target - Target node/value
   * @param {*} context - Context (null = auto-generate)
   * @returns {*} Context (handle/identity)
   */
  add(source, attr, target, context = null) {
    // Auto-generate context if null
    const edgeContext = context ?? `edge:${this.nextId}`;

    // Check for existing edge (dedupe by 4-tuple)
    const existing = this.edges.find(
      (e) =>
        e.source === source &&
        e.attr === attr &&
        e.target === target &&
        e.context === edgeContext,
    );

    if (existing) {
      return existing.context;
    }

    const edge = {
      source,
      attr,
      target,
      context: edgeContext,
      id: this.nextId++,
    };

    if (this.inBatch) {
      // Accumulate in batch, don't update patterns yet
      this.batchEdges.push(edge);
    } else {
      // Immediate mode - add and update patterns
      this.edges.push(edge);
      this.updatePatterns(edge);
    }

    return edge.context;
  }

  /**
   * Update all active patterns with a new edge
   * @private
   */
  updatePatterns(edge) {
    // Get only patterns that could match this edge
    const candidates = this.getCandidatePatterns(edge);

    // Update only candidate patterns
    for (const pattern of candidates) {
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

  /**
   * Register a pattern in the activation indexes
   * @private
   */
  indexPattern(pattern) {
    // If pattern has any wildcards/variables, add to wildcard set
    if (pattern.hasWildcardsOrVariables()) {
      this.wildcardPatterns.add(pattern);
      return; // Don't index in literal indexes
    }

    // Pure literal pattern - create composite key for specificity
    // Index by the COMBINATION of literals to avoid over-activation
    const { sources, attrs, targets, contexts } = pattern.getLiteralValues();

    // Index by most specific field (prefer source > attr > target > context)
    // This prevents patterns from being activated by common attributes
    if (sources.size > 0) {
      // Index by source (most selective usually)
      for (const source of sources) {
        if (!this.sourceIndex.has(source)) {
          this.sourceIndex.set(source, new Set());
        }
        this.sourceIndex.get(source).add(pattern);
      }
    } else if (attrs.size > 0) {
      // No source literals, index by attr
      for (const attr of attrs) {
        if (!this.attrIndex.has(attr)) {
          this.attrIndex.set(attr, new Set());
        }
        this.attrIndex.get(attr).add(pattern);
      }
    } else if (targets.size > 0) {
      // Only target literals, index by target
      for (const target of targets) {
        if (!this.targetIndex.has(target)) {
          this.targetIndex.set(target, new Set());
        }
        this.targetIndex.get(target).add(pattern);
      }
    } else if (contexts.size > 0) {
      // Only context literals, index by context
      for (const context of contexts) {
        if (!this.contextIndex.has(context)) {
          this.contextIndex.set(context, new Set());
        }
        this.contextIndex.get(context).add(pattern);
      }
    } else {
      // No literals at all? Shouldn't happen if hasWildcardsOrVariables() returned false
      this.wildcardPatterns.add(pattern);
    }
  }

  /**
   * Remove a pattern from activation indexes
   * @private
   */
  unindexPattern(pattern) {
    // Remove from wildcard patterns
    this.wildcardPatterns.delete(pattern);

    // Remove from literal indexes
    const { sources, attrs, targets, contexts } = pattern.getLiteralValues();

    for (const source of sources) {
      const set = this.sourceIndex.get(source);
      if (set) {
        set.delete(pattern);
        if (set.size === 0) {
          this.sourceIndex.delete(source);
        }
      }
    }

    for (const attr of attrs) {
      const set = this.attrIndex.get(attr);
      if (set) {
        set.delete(pattern);
        if (set.size === 0) {
          this.attrIndex.delete(attr);
        }
      }
    }

    for (const target of targets) {
      const set = this.targetIndex.get(target);
      if (set) {
        set.delete(pattern);
        if (set.size === 0) {
          this.targetIndex.delete(target);
        }
      }
    }

    for (const context of contexts) {
      const set = this.contextIndex.get(context);
      if (set) {
        set.delete(pattern);
        if (set.size === 0) {
          this.contextIndex.delete(context);
        }
      }
    }
  }

  /**
   * Get patterns that could potentially match this edge
   * @private
   */
  getCandidatePatterns(edge) {
    const candidates = new Set();

    // Always include wildcard patterns
    for (const p of this.wildcardPatterns) {
      candidates.add(p);
    }

    // Include patterns watching for this specific source
    const sourcePatterns = this.sourceIndex.get(edge.source);
    if (sourcePatterns) {
      for (const p of sourcePatterns) {
        candidates.add(p);
      }
    }

    // Include patterns watching for this specific attr
    const attrPatterns = this.attrIndex.get(edge.attr);
    if (attrPatterns) {
      for (const p of attrPatterns) {
        candidates.add(p);
      }
    }

    // Include patterns watching for this specific target
    const targetPatterns = this.targetIndex.get(edge.target);
    if (targetPatterns) {
      for (const p of targetPatterns) {
        candidates.add(p);
      }
    }

    // Include patterns watching for this specific context
    const contextPatterns = this.contextIndex.get(edge.context);
    if (contextPatterns) {
      for (const p of contextPatterns) {
        candidates.add(p);
      }
    }

    return candidates;
  }

  /**
   * Get all edges with a specific context
   * @param {*} contextName - Context to filter by
   * @returns {Array} Edges with the given context
   */
  getEdgesInContext(contextName) {
    return this.edges.filter((e) => e.context === contextName);
  }

  /**
   * List all unique contexts in the graph
   * @returns {Array} Unique context values
   */
  listContexts() {
    return [...new Set(this.edges.map((e) => e.context))];
  }
}

// ============================================================================
// Phase 2: Pattern Matching Engine
// ============================================================================

export class Pattern {
  constructor(spec, nacSpec = [], graph = null) {
    this.spec = spec; // [[s,a,t], ...] pattern specification
    this.nacSpec = nacSpec; // [[s,a,t], ...] NAC patterns (must NOT match)
    this.graph = graph; // Reference to the graph (for NAC checking)
    this.partial = new Map(); // Map<edgeId, PartialMatch>
    this.complete = []; // Array<CompleteMatch>
    this.onComplete = null; // Callback when pattern matches
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
          // Check NAC conditions before accepting as complete
          if (this.checkNAC(extended.bindings, extended.edges)) {
            this.complete.push(extended);
            toRemove.push(id);
            // Fire callback if registered
            if (this.onComplete) {
              this.onComplete(extended.bindings);
            }
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
        // Check NAC conditions before accepting as complete
        if (this.checkNAC(started.bindings, started.edges)) {
          this.complete.push(started);
          if (this.onComplete) {
            this.onComplete(started.bindings);
          }
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
      const [s, a, t, c] = this.spec[i];
      const bindings = new Map();

      if (this.matches(edge, s, a, t, c, bindings)) {
        return {
          matched: [i],
          bindings,
          edges: [edge],
          isComplete: this.spec.length === 1,
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

      const [s, a, t, c] = this.spec[i];
      const bindings = new Map(partial.bindings);

      if (this.matches(edge, s, a, t, c, bindings)) {
        const matched = [...partial.matched, i];
        return {
          matched,
          bindings,
          edges: [...partial.edges, edge],
          isComplete: matched.length === this.spec.length,
        };
      }
    }
    return null;
  }

  /**
   * Check if an edge matches a pattern quad with variable binding
   */
  matches(edge, s, a, t, c, bindings) {
    return (
      this.matchField(edge.source, s, bindings) &&
      this.matchField(edge.attr, a, bindings) &&
      this.matchField(edge.target, t, bindings) &&
      this.matchField(edge.context, c, bindings)
    );
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

  /**
   * Check NAC conditions - returns true if NO nac patterns match
   * @param {Map} bindings - Current variable bindings
   * @param {Array} matchedEdges - Edges that were matched (not used anymore)
   */
  checkNAC(bindings, matchedEdges) {
    // If no NAC patterns, always pass
    if (!this.nacSpec || this.nacSpec.length === 0) {
      return true;
    }

    // If no graph reference, can't check NAC (shouldn't happen)
    if (!this.graph) {
      return true;
    }

    // Check each NAC pattern - if ANY match, return false
    for (const [s, a, t, c] of this.nacSpec) {
      // Apply current bindings to the NAC pattern
      const resolvedS = this.resolveValue(s, bindings);
      const resolvedA = this.resolveValue(a, bindings);
      const resolvedT = this.resolveValue(t, bindings);
      const resolvedC = this.resolveValue(c, bindings);

      // Check if this NAC pattern matches any edge in the graph
      for (const edge of this.graph.edges) {
        const nacBindings = new Map(bindings);
        if (
          this.matches(
            edge,
            resolvedS,
            resolvedA,
            resolvedT,
            resolvedC,
            nacBindings,
          )
        ) {
          // NAC pattern matched - this violates the condition
          return false;
        }
      }
    }

    // No NAC patterns matched - the NAC conditions are satisfied
    return true;
  }

  /**
   * Resolve a value using current bindings
   */
  resolveValue(value, bindings) {
    if (
      typeof value === "string" && value.startsWith("?") && bindings.has(value)
    ) {
      return bindings.get(value);
    }
    return value;
  }

  /**
   * Check if a value is a wildcard or variable
   * @private
   */
  isWildcardOrVariable(value) {
    if (value === "*" || value === null || value === undefined) {
      return true;
    }
    if (typeof value === "string" && value.startsWith("?")) {
      return true;
    }
    return false;
  }

  /**
   * Determine if this pattern uses any wildcards or variables
   * @returns {boolean}
   */
  hasWildcardsOrVariables() {
    for (const [s, a, t, c] of this.spec) {
      if (this.isWildcardOrVariable(s)) return true;
      if (this.isWildcardOrVariable(a)) return true;
      if (this.isWildcardOrVariable(t)) return true;
      if (this.isWildcardOrVariable(c)) return true;
    }
    // Also check NAC spec
    for (const [s, a, t, c] of this.nacSpec) {
      if (this.isWildcardOrVariable(s)) return true;
      if (this.isWildcardOrVariable(a)) return true;
      if (this.isWildcardOrVariable(t)) return true;
      if (this.isWildcardOrVariable(c)) return true;
    }
    return false;
  }

  /**
   * Get all literal values from this pattern's spec
   * @returns {{ sources: Set, attrs: Set, targets: Set, contexts: Set }}
   */
  getLiteralValues() {
    const sources = new Set();
    const attrs = new Set();
    const targets = new Set();
    const contexts = new Set();

    for (const [s, a, t, c] of this.spec) {
      if (!this.isWildcardOrVariable(s)) sources.add(s);
      if (!this.isWildcardOrVariable(a)) attrs.add(a);
      if (!this.isWildcardOrVariable(t)) targets.add(t);
      if (!this.isWildcardOrVariable(c)) contexts.add(c);
    }

    return { sources, attrs, targets, contexts };
  }
}

// ============================================================================
// Phase 3: High-Level API (Added to Graph class)
// ============================================================================

// Add these methods to the Graph class
Object.assign(Graph.prototype, {
  /**
   * One-shot query - find all current matches
   * @param {...Array} spec - Pattern specification (can be arrays or object with patterns/nac)
   * @returns {Array<Map>} Array of variable bindings
   */
  query(...spec) {
    let patterns, nac;

    // Check if first arg is an object with patterns/nac structure
    if (spec.length === 1 && spec[0].patterns) {
      patterns = spec[0].patterns;
      nac = spec[0].nac || [];
    } else {
      // Traditional usage - just pattern arrays
      patterns = spec;
      nac = [];
    }

    const pattern = new Pattern(patterns, nac, this);

    // Process all existing edges
    for (const edge of this.edges) {
      pattern.update(edge);
    }

    // Return bindings from complete matches, with edges attached
    return pattern.complete.map((match) => {
      // Attach matched edges to bindings Map for formatter access
      match.bindings.__edges__ = match.edges;
      return match.bindings;
    });
  },

  /**
   * Watch for pattern matches (persistent)
   * @param {Array} spec - Pattern specification (can be arrays or object with patterns/nac)
   * @param {Function} onMatch - Callback for matches
   * @returns {Function} Unwatch function
   */
  watch(spec, onMatch) {
    let patterns, nac;

    // Check if spec is an object with patterns/nac structure
    if (spec.patterns) {
      patterns = spec.patterns;
      nac = spec.nac || [];
    } else {
      // Traditional usage - just pattern arrays
      patterns = spec;
      nac = [];
    }

    const pattern = new Pattern(patterns, nac, this);
    pattern.onComplete = onMatch;

    // Process existing edges
    for (const edge of this.edges) {
      pattern.update(edge);
    }

    // Register for future updates
    this.patterns.push(pattern);

    // Register pattern in activation indexes
    this.indexPattern(pattern);

    // Return unwatch function
    return () => {
      const idx = this.patterns.indexOf(pattern);
      if (idx >= 0) {
        this.patterns.splice(idx, 1);
        this.unindexPattern(pattern); // Remove from indexes
      }
    };
  },

  /**
   * Query and return results as a new Graph
   * This enables query composition - the result is itself queryable
   * @param {...Array} spec - Pattern specification
   * @returns {Graph} New graph containing edges that matched the pattern
   */
  queryAsGraph(...spec) {
    let patterns, nac;

    // Check if first arg is an object with patterns/nac structure
    if (spec.length === 1 && spec[0].patterns) {
      patterns = spec[0].patterns;
      nac = spec[0].nac || [];
    } else {
      // Traditional usage - just pattern arrays
      patterns = spec;
      nac = [];
    }

    const pattern = new Pattern(patterns, nac, this);

    // Process all existing edges
    for (const edge of this.edges) {
      pattern.update(edge);
    }

    // Create new graph with matching edges
    const resultGraph = new Graph();

    // Add all edges that were part of complete matches
    const addedEdges = new Set();
    for (const match of pattern.complete) {
      for (const edge of match.edges) {
        // Avoid duplicates if edge appears in multiple matches
        if (!addedEdges.has(edge.id)) {
          resultGraph.add(edge.source, edge.attr, edge.target);
          addedEdges.add(edge.id);
        }
      }
    }

    return resultGraph;
  },
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
