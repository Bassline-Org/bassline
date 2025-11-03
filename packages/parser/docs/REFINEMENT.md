# Monotonic Refinement Pattern

## Overview

This document explains how the graph rewriting system handles updates and aggregations in an append-only, monotonic system through the **refinement pattern**.

## The Problem

In an append-only graph system, we cannot delete or modify edges. This creates challenges for:
- **Aggregations**: How do we update a SUM when new items are added?
- **Computations**: How do we replace outdated results?
- **State management**: How do we track "current" values?

## The Solution: Refinement Chains

Instead of modifying edges, we add new edges that **refine** (supersede) old ones. The system maintains a refinement chain that tracks which values are current.

### Core Concepts

1. **Versioned Results**: Each result has a version identifier
2. **Refinement Edges**: Explicit edges marking supersession
3. **NAC Queries**: Use Negative Application Conditions to find non-refined (current) values

## Example: Incremental Aggregation

```javascript
// Initial state
AGG1 AGGREGATE SUM
AGG1 ITEM 10

// Watcher produces:
AGG1 AGG1:RESULT:V1 10
AGG1:STATE:V1 SUM 10
AGG1:STATE:V1 COUNT 1
AGG1:VERSION CURRENT 1

// Add another item
AGG1 ITEM 20

// Watcher produces:
AGG1 AGG1:RESULT:V2 30
AGG1:STATE:V2 SUM 30
AGG1:STATE:V2 COUNT 2
AGG1:RESULT:V2 REFINES AGG1:RESULT:V1  // V2 supersedes V1
AGG1:VERSION CURRENT 2

// Add third item
AGG1 ITEM 30

// Watcher produces:
AGG1 AGG1:RESULT:V3 60
AGG1:STATE:V3 SUM 60
AGG1:STATE:V3 COUNT 3
AGG1:RESULT:V3 REFINES AGG1:RESULT:V2  // V3 supersedes V2
AGG1:VERSION CURRENT 3
```

## Querying for Current Values

### Method 1: Version-Based Query

```javascript
// Get the highest version number
const versionResults = graph.query([aggId + ":VERSION", "CURRENT", "?V"]);
const maxVersion = Math.max(...versionResults.map(r => r.get("?V")));

// Get result for that version
const resultKey = `${aggId}:RESULT:V${maxVersion}`;
const result = graph.query([aggId, resultKey, "?R"])[0].get("?R");
```

### Method 2: NAC-Based Query (Declarative)

```javascript
// Find results that aren't refined by anything
const currentResults = graph.query({
  patterns: [[aggId, "?resultKey", "?value"]],
  nac: [["?newer", "REFINES", "?resultKey"]]
});
// Returns only the current (non-refined) result
```

## Benefits

### 1. True Monotonicity
- The log only grows, never shrinks
- All history is preserved
- Time-travel debugging is possible

### 2. Distributed Consistency
- No coordination needed for writes
- Refinement chains can be merged deterministically
- Works with eventual consistency

### 3. Auditability
- Complete computation history
- Can trace how values evolved
- Debugging shows all intermediate states

## Implementation Details

### Watcher Pattern

```javascript
graph.watch([["?A", "ITEM", "?V"]], (bindings) => {
  const aggId = bindings.get("?A");
  const value = bindings.get("?V");

  // Increment version
  const newVersion = getCurrentVersion(aggId) + 1;

  // Calculate new state
  const newState = computeNewState(prevState, value);

  // Add versioned result
  const resultKey = `${aggId}:RESULT:V${newVersion}`;
  graph.add(aggId, resultKey, newState.result);

  // Mark as refining previous
  if (prevVersion > 0) {
    const prevResultKey = `${aggId}:RESULT:V${prevVersion}`;
    graph.add(resultKey, "REFINES", prevResultKey);
  }
});
```

### Helper Functions

```javascript
// Get current (non-refined) result
export function getCurrentResult(graph, aggId) {
  const allResults = graph.edges.filter(e =>
    e.source === aggId &&
    e.attr.toString().startsWith(`${aggId}:RESULT:V`)
  );

  for (const edge of allResults) {
    const resultKey = edge.attr;
    const value = edge.target;

    // Check if refined by anything
    const isRefined = graph.edges.some(e =>
      e.attr === "REFINES" && e.target === resultKey
    );

    if (!isRefined) {
      return value; // This is current
    }
  }

  return null;
}
```

## Comparison with Other Approaches

### Approach 1: Last-Write-Wins (Ordering-Based)
**Problem**: Relies on array ordering, fragile with concurrent writes
```javascript
// BAD: Assumes last item in array is current
const results = graph.query([aggId, "RESULT", "?R"]);
return results[results.length - 1].get("?R");
```

### Approach 2: External State (Map-Based)
**Problem**: State lives outside the graph, breaks monotonicity
```javascript
// BAD: Mutable external state
const aggregationState = new Map();
aggregationState.set(aggId, { sum: 30, count: 2 });
```

### Approach 3: Refinement Pattern (This Document)
**Solution**: All state in graph, explicit supersession semantics
```javascript
// GOOD: Declarative, monotonic, auditable
const current = getCurrentResultViaQuery(graph, aggId);
```

## Advanced Patterns

### Batch Aggregation

For efficiency, you might want to process multiple items at once:

```javascript
graph.batch(() => {
  graph.add("AGG1", "ITEM", 10);
  graph.add("AGG1", "ITEM", 20);
  graph.add("AGG1", "ITEM", 30);
});
// Watcher could buffer and produce single result
```

### Stratified Refinement

Group refinements by epoch for bulk processing:

```javascript
AGG1:RESULT:E1:V1 10   // Epoch 1, Version 1
AGG1:RESULT:E1:V2 30   // Epoch 1, Version 2
AGG1:RESULT:E2:V1 60   // Epoch 2, Version 1 (new epoch)
```

### Garbage Collection (Optional)

While keeping history is valuable, you might mark old refinements:

```javascript
// Mark old versions as archived (but don't delete)
graph.add(oldResultKey, "ARCHIVED", true);

// Query only non-archived current results
graph.query({
  patterns: [[aggId, "?key", "?value"]],
  nac: [
    ["?newer", "REFINES", "?key"],
    ["?key", "ARCHIVED", true]
  ]
});
```

## Related Concepts

This refinement pattern aligns with:

- **CRDT Theory**: Causal contexts and version vectors
- **Event Sourcing**: Append-only logs with computed views
- **Lattice Operations**: Monotonic joins in partial orders
- **IVM (Incremental View Maintenance)**: Delta propagation

## Summary

The refinement pattern enables updates in an append-only system by:
1. **Versioning all mutable state**
2. **Adding explicit REFINES edges**
3. **Using NAC to query current values**
4. **Maintaining complete history**

This gives us the benefits of immutability (auditability, distribution, debugging) while still supporting practical computation patterns like aggregation and state updates.