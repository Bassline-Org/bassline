/**
 * Subgraph - Reactive filtered views of the main graph
 *
 * Solves the wildcard scaling problem by restricting search space
 */

export class Subgraph {
  constructor(name, parentGraph) {
    this.name = name;
    this.parent = parentGraph;
    this.edges = [];
    this.patterns = [];
    this.filters = [];
    this.indexes = new Map(); // Local indexes for this subgraph
  }

  /**
   * Define a filter that determines which edges belong in this subgraph
   * Filters are literal patterns that efficiently select edges
   */
  addFilter(pattern) {
    this.filters.push(pattern);

    // Set up reactive updates - when matching edges are added to parent, copy to subgraph
    const unwatch = this.parent.watch(pattern, (bindings) => {
      // Find the edge that triggered this match
      // In a real implementation, we'd pass the edge through the binding
      const lastEdge = this.parent.edges[this.parent.edges.length - 1];

      // Add to our subgraph
      this.edges.push(lastEdge);

      // Update our local patterns with the new edge
      this.updateLocalPatterns(lastEdge);
    });

    // Also process existing edges
    const matches = this.parent.query(pattern);
    // In production, we'd need to reconstruct which edges matched

    return unwatch;
  }

  /**
   * Add a wildcard pattern that only searches this subgraph
   * This is where we get the performance benefit!
   */
  watch(spec, onMatch) {
    const pattern = new SubgraphPattern(spec, this);
    pattern.onComplete = onMatch;

    // Process existing edges in our subgraph (not parent!)
    for (const edge of this.edges) {
      pattern.update(edge);
    }

    this.patterns.push(pattern);

    return () => {
      const idx = this.patterns.indexOf(pattern);
      if (idx >= 0) {
        this.patterns.splice(idx, 1);
      }
    };
  }

  /**
   * Update patterns when new edges are added to subgraph
   */
  updateLocalPatterns(edge) {
    for (const pattern of this.patterns) {
      pattern.update(edge);
    }
  }

  /**
   * Query only within this subgraph
   */
  query(spec) {
    const pattern = new SubgraphPattern(spec, this);

    // Only search our edges, not parent's!
    for (const edge of this.edges) {
      pattern.update(edge);
    }

    return pattern.complete.map(match => match.bindings);
  }
}

/**
 * Pattern that operates on a subgraph instead of the full graph
 */
class SubgraphPattern {
  constructor(spec, subgraph) {
    this.spec = spec;
    this.subgraph = subgraph;
    this.partial = new Map();
    this.complete = [];
    this.onComplete = null;
  }

  update(edge) {
    // Same pattern matching logic, but only operates on subgraph edges
    // This is the key optimization - wildcard patterns only check edges in the subgraph

    // Simplified implementation - in production would use full pattern matching
    for (const [s, a, t] of this.spec) {
      if (this.matches(edge, s, a, t)) {
        const bindings = new Map();
        this.bindVariables(edge, s, a, t, bindings);

        this.complete.push({ bindings, edges: [edge] });

        if (this.onComplete) {
          this.onComplete(bindings);
        }
      }
    }
  }

  matches(edge, s, a, t) {
    return this.matchField(edge.source, s) &&
           this.matchField(edge.attr, a) &&
           this.matchField(edge.target, t);
  }

  matchField(value, pattern) {
    if (pattern === "*" || pattern === null) return true;
    if (typeof pattern === "string" && pattern.startsWith("?")) return true;
    return pattern === value;
  }

  bindVariables(edge, s, a, t, bindings) {
    if (typeof s === "string" && s.startsWith("?")) bindings.set(s, edge.source);
    if (typeof a === "string" && a.startsWith("?")) bindings.set(a, edge.attr);
    if (typeof t === "string" && t.startsWith("?")) bindings.set(t, edge.target);
  }
}

/**
 * Extended Graph class with subgraph support
 */
export function installSubgraphs(Graph) {
  Graph.prototype.createSubgraph = function(name) {
    const subgraph = new Subgraph(name, this);

    // Store subgraphs on the graph
    if (!this.subgraphs) {
      this.subgraphs = new Map();
    }
    this.subgraphs.set(name, subgraph);

    return subgraph;
  };

  Graph.prototype.getSubgraph = function(name) {
    return this.subgraphs?.get(name);
  };
}