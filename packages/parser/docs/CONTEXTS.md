# Contexts: Relations About Relations

## Overview

Bassline edges are **quads** (4-tuples): `(source, attr, target, context)`.

The context field enables:

- **Provenance tracking** - where did this data come from?
- **Grouping** - which edges were added together?
- **Relations about relations** - make edges about edge groups
- **Rule causality** - what produced this edge?
- **Fine-grained pattern matching** - activate only on specific contexts

## Core Behavior

### Edge Creation

```javascript
// Auto-generate context when null
const ctx1 = graph.add("Alice", "age", 30, null); // Returns "edge:0"
const ctx2 = graph.add("Bob", "age", 25, null); // Returns "edge:1"

// Explicit context
const ctx = graph.add("Alice", "city", "NYC", "census-2024"); // Returns "census-2024"

// Returns the context as a handle
graph.add("Alice", "name", "Alice Smith", "import-batch-1"); // Returns "import-batch-1"
```

**Key behaviors:**

- Context defaults to `null` → auto-generates unique context `edge:${id}`
- Returns the context (the edge's identity/handle)
- Same 4-tuple = deduplicated (won't create duplicate)
- Different context = different edge (even if s/a/t same)

### Deduplication by 4-Tuple

```javascript
// Same 4-tuple = deduplicated
graph.add("Alice", "age", 30, "ctx-1"); // Creates edge
graph.add("Alice", "age", 30, "ctx-1"); // Returns existing edge's context (no duplicate)

// Different context = different edge
graph.add("Alice", "age", 30, "ctx-1"); // Edge 1
graph.add("Alice", "age", 30, "ctx-2"); // Edge 2 (different!)

// Auto-generated contexts are unique
graph.add("Alice", "age", 30, null); // Edge with context "edge:0"
graph.add("Alice", "age", 30, null); // Edge with context "edge:1" (different!)
```

## Pattern Matching

All patterns are 4-tuples. The 4th element matches the context field.

```javascript
// Match only edges with null context (auto-generated)
graph.query([["Alice", "age", "?a", null]]);

// Match specific context
graph.query([["?p", "age", "?a", "census-2024"]]);

// Bind context to variable
graph.query([["Alice", "age", "?a", "?ctx"]]);
// Returns: [{?a: 30, ?ctx: "census-2024"}]

// Wildcard matches ANY context
graph.query([["Alice", "age", "?a", "*"]]);
```

## Relations About Relations

Contexts are first-class entities - you can make edges about them!

```javascript
// Import batch with context
const batchId = "import-2024-01-15";
graph.add("Alice", "age", 30, batchId);
graph.add("Bob", "age", 25, batchId);
graph.add("Charlie", "age", 35, batchId);

// Make edges ABOUT the batch
graph.add(batchId, "source", "census-bureau");
graph.add(batchId, "confidence", 0.95);
graph.add(batchId, "timestamp", Date.now());
graph.add(batchId, "imported-by", "admin");

// Query metadata about a batch
const metadata = graph.query([[batchId, "?attr", "?value"]]);
// Returns: [
//   {?attr: "source", ?value: "census-bureau"},
//   {?attr: "confidence", ?value: 0.95},
//   ...
// ]

// Query all edges in a batch + their metadata
const edges = graph.query([
  ["?s", "?a", "?t", batchId],
  [batchId, "source", "?source"],
]);
```

## Use Cases

### 1. Provenance Tracking

```javascript
// Different data sources
graph.add("Alice", "age", 30, "census-2024");
graph.add("Alice", "age", 29, "user-profile");

graph.add("census-2024", "confidence", 0.95);
graph.add("user-profile", "confidence", 0.7);

// Query high-confidence ages
const results = graph.query([
  ["?person", "age", "?age", "?source"],
  ["?source", "confidence", "?conf"],
]);
// Filter by confidence > 0.9
```

### 2. Rule Causality

```javascript
// Rule produces edges with its own context
graph.watch([["?p", "age", "?a"]], (bindings) => {
  if (bindings.get("?a") >= 18) {
    const ruleContext = "rule:adult-check";
    graph.add(bindings.get("?p"), "adult", true, ruleContext);

    // Record what triggered this
    graph.add(ruleContext, "triggered-by", bindings.__edges__[0].context);
  }
});

// Later: "Why is Alice marked as adult?"
const cause = graph.query([
  ["Alice", "adult", true, "?ruleCtx"],
  ["?ruleCtx", "triggered-by", "?trigger"],
]);
```

### 3. Batch Operations

```javascript
const txId = `tx:${Date.now()}`;

graph.batch(() => {
  graph.add("Alice", "imported", true, txId);
  graph.add("Bob", "imported", true, txId);
  graph.add("Charlie", "imported", true, txId);
});

graph.add(txId, "user", "admin");
graph.add(txId, "timestamp", Date.now());

// Rollback a batch (hypothetically)
const edgesToRemove = graph.getEdgesInContext(txId);
```

### 4. Hypothetical Reasoning

```javascript
// Baseline
graph.add("Alice", "salary", 50000, "baseline");

// Scenario: promotion
graph.add("Alice", "salary", 60000, "scenario:promotion");
graph.add("scenario:promotion", "probability", 0.7);

// Scenario: job-change
graph.add("Alice", "salary", 70000, "scenario:job-change");
graph.add("scenario:job-change", "probability", 0.3);

// Query specific scenario
const promotionSalary = graph.query([
  ["Alice", "salary", "?s", "scenario:promotion"],
]);
```

### 5. Multi-Tenancy

```javascript
// Tenant-specific data
graph.add("Product:123", "price", 100, "tenant:acme");
graph.add("Product:123", "price", 90, "tenant:corp");

graph.add("tenant:acme", "plan", "enterprise");
graph.add("tenant:corp", "plan", "basic");

// Tenant-specific query
const acmePrices = graph.query([
  ["?product", "price", "?price", "tenant:acme"],
]);
```

## Performance: Selective Activation

Contexts enhance performance through **context-specific pattern indexing**.

### How It Works

Patterns are indexed by their literal values, including contexts:

```javascript
// Pattern with context literal
graph.watch([["?p", "age", "?a", "real-time"]], callback);

// Indexed in:
// - attrIndex["age"] → [pattern]
// - contextIndex["real-time"] → [pattern]

// When edge arrives with context "batch-import":
graph.add("Alice", "age", 30, "batch-import");

// Only activates patterns indexed under:
// - sourceIndex["Alice"]
// - attrIndex["age"]
// - targetIndex[30]
// - contextIndex["batch-import"]
// - wildcardPatterns

// Pattern watching "real-time" context is NOT activated!
```

### Performance Benefits

**Without contexts:**

- Pattern: `[["?p", "age", "?a"]]` activates for ALL age edges

**With contexts:**

- Pattern: `[["?p", "age", "?a", "real-time"]]` only activates for real-time
  edges
- Pattern: `[["?p", "age", "?a", "batch-import"]]` only activates for batch
  edges

**Result:** More selective activation = fewer pattern checks = better
performance.

## Helper Methods

```javascript
// Get all edges with specific context
const edges = graph.getEdgesInContext("import-batch-1");
// Returns: [{source, attr, target, context, id}, ...]

// List all unique contexts
const contexts = graph.listContexts();
// Returns: ["edge:0", "edge:1", "census-2024", "import-batch-1", ...]
```

## Integration with Extensions

### Aggregation

```javascript
import {
  builtinAggregations,
  installAggregation,
} from "@bassline/parser/aggregation";

installAggregation(graph, builtinAggregations);

// Set up aggregation with context
const aggContext = "agg:sales:2024";
graph.add("sales:2024", "AGGREGATE", "SUM", aggContext);

// Items added with different contexts
graph.add("sales:2024", "ITEM", 100, "sale:1");
graph.add("sales:2024", "ITEM", 250, "sale:2");

// Result has its own context
const resultContext = "agg:sales:2024:v1";
graph.add("sales:2024", "RESULT:V1", 350, resultContext);

// Metadata about result
graph.add(resultContext, "computed-at", Date.now());
graph.add(resultContext, "triggered-by", "sale:2");
```

### Rules

```javascript
// Rules can specify context for produced edges
graph.watch([["?p", "age", "?a"]], (bindings) => {
  const ruleContext = `rule:adult-check:${Date.now()}`;
  graph.add(bindings.get("?p"), "adult", true, ruleContext);

  // Self-describing
  graph.add(ruleContext, "type", "rule-execution");
  graph.add(ruleContext, "rule", "adult-check");
  graph.add(ruleContext, "input", bindings.__edges__[0].context);
});
```

## Design Principles

1. **Contexts are data** - no special semantics, just another field
2. **First-class entities** - can be subjects/targets in other edges
3. **Handles for grouping** - logical buckets without ownership semantics
4. **Optional auto-generation** - `null` → unique context
5. **Deduplication by 4-tuple** - same quad = same edge
6. **Performance-preserving** - indexed for selective activation

## Migration Notes

**Before (triples):**

```javascript
graph.add("Alice", "age", 30); // Returns edge id
```

**After (quads):**

```javascript
graph.add("Alice", "age", 30, null); // Returns context (auto-generated)
graph.add("Alice", "age", 30, "my-context"); // Returns "my-context"
```

All pattern matching now requires 4-tuples:

```javascript
// Before:
graph.query([["Alice", "age", "?a"]]);

// After:
graph.query([["Alice", "age", "?a", "*"]]); // Wildcard for any context
```

---

**Key Insight:** Contexts enable **meta-level reasoning** - the ability to make
statements about statements, track provenance, debug causality, and organize
related data - all while maintaining O(1) pattern activation performance.
