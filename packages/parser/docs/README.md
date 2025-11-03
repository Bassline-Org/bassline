# Bassline Pattern Matching Engine

A powerful incremental computation engine where everything is patterns over an append-only log of edges.

## What This Is

This is NOT just a parser or a graph database. This is a **universal computation engine** where:

- **Patterns ARE computations** (gadgets)
- **Edges ARE state and effects**
- **Watchers ARE incremental updates**
- **Queries ARE composable subgraphs**

Every watcher you create is a gadget. Every pattern match triggers computation. Every edge added propagates effects. It's all one uniform model.

## Core Concepts

### Everything is Edges

```javascript
// Adding edges to the graph
graph.add("alice", "likes", "bob");
graph.add("alice", "age", 30);
graph.add("bob", "age", 25);
```

### Everything is Patterns

```javascript
// Find all people who like someone
graph.query([
  ["?person", "likes", "?other"],
  ["?person", "age", "?age"]
]);
```

### Everything is Computation

```javascript
// This IS a gadget - incremental computation over edges
graph.watch([["?x", "temperature", "?t"]], (bindings) => {
  const temp = bindings.get("?t");
  if (temp > 100) {
    // Adding edges triggers other patterns - this is emit()
    graph.add(bindings.get("?x"), "alert", "overheating");
  }
});
```

### Everything is Self-Describing

The system describes itself through edges - no separate reflection API needed:

```javascript
// Operations describe themselves when installed
query [?o TYPE OPERATION!]
// → [ADD, MULTIPLY, SQRT, GT, ...]

// Get operation documentation
query [ADD DOCS ?d]
// → ["Binary addition"]

// Rules describe themselves when created
rule ADULT [?p AGE ?a] -> [?p ADULT TRUE]
query [?r TYPE RULE!]
// → [ADULT]

// Even types describe themselves
query [?t TYPE TYPE!]
// → [OPERATION!, AGGREGATION!, RULE!, PATTERN!, TYPE!]
```

The type system closes the loop: `TYPE! TYPE TYPE!` 🔁

See [SELF-DESCRIPTION.md](SELF-DESCRIPTION.md) for details.

## Why This is Better

Traditional gadget model:
- Hidden state in symbols
- Method calls for composition
- Not queryable
- Not distributable

Pattern matching model:
- **State is edges** (queryable, auditable)
- **Composition is patterns triggering patterns**
- **Everything is visible**
- **Edges can flow anywhere** (distributed by default)

## Performance

With our optimizations, this is one of the fastest pattern matching engines:

- **O(1) for literal patterns** via selective activation
- **4.4M edges/second** throughput
- **67-235x speedup** over naive implementation
- **Scales to millions of patterns and edges**

## Quick Start

```javascript
import { Graph } from "@bassline/parser";

// Create a graph
const graph = new Graph();

// Add edges
graph.add("sensor1", "temperature", 72);
graph.add("sensor1", "location", "room1");

// Query
const results = graph.query([
  ["?sensor", "temperature", "?temp"],
  ["?sensor", "location", "room1"]
]);

// Watch for patterns (incremental computation)
graph.watch([
  ["?sensor", "temperature", "?temp"]
], (bindings) => {
  console.log(`Sensor ${bindings.get("?sensor")}: ${bindings.get("?temp")}°`);
});

// Query composition - results as new graphs
const room1 = graph.queryAsGraph([["?s", "location", "room1"]]);
const hotSensors = room1.query([["?s", "temperature", "?t"]])
  .filter(b => b.get("?t") > 80);
```

## Pattern Language

The system includes a DSL for defining patterns:

```
; Add facts
fact [alice type person] [alice age 30]

; Query with variables
query [?x type person] [?x age ?a]

; Watch patterns (incremental)
watch [?x needs-processing true] -> [
  compute ?x
]

; Rules (graph rewriting)
rule adult [?p type person] [?p age ?a] -> [?p adult true]

; Negative conditions (NAC)
query [?x type person | not ?x deleted true]
```

## Key Patterns

### Incremental Aggregation

```javascript
// Aggregate values using refinement pattern
graph.watch([
  ["sum", "item", "?value"]
], (bindings) => {
  const v = bindings.get("?value");
  const current = getCurrentSum(graph, "sum");
  const newSum = current + v;

  // Versioned updates (monotonic)
  graph.add("sum", `result:v${version++}`, newSum);
});
```

### Query Composition

```javascript
// Queries return graphs that can be queried again
const people = graph.queryAsGraph([["?x", "type", "person"]]);
const adults = people.query([["?x", "age", "?a"]])
  .filter(b => b.get("?a") >= 18);
```

### Pattern Cascades

```javascript
// Patterns trigger patterns - this is composition
graph.watch([["?x", "needs-validation", true]], (b) => {
  graph.add(b.get("?x"), "validating", true);
});

graph.watch([["?x", "validating", true]], (b) => {
  // Validation logic
  graph.add(b.get("?x"), "validated", true);
  graph.add(b.get("?x"), "needs-validation", false);
});
```

## Architecture

```
minimal-graph.js   - Core pattern matching engine (607 lines)
pattern-parser.js  - DSL parser for pattern syntax
pattern-words.js   - Runtime for executing DSL commands
compute.js        - Pattern-based computation examples
self-description.js - Meta-patterns (patterns that create patterns)
```

## Learn More

- [CORE.md](CORE.md) - Deep dive into the computation model
- [SELF-DESCRIPTION.md](SELF-DESCRIPTION.md) - How the system describes itself
- [PERFORMANCE.md](PERFORMANCE.md) - Optimization strategies and benchmarks
- [COOKBOOK.md](COOKBOOK.md) - Common patterns and recipes

## The Insight

This isn't a different way to do computation. This IS computation, stripped to its essence:
- **Pattern matching** over **append-only state**
- **Incremental updates** via **watchers**
- **Composition** through **pattern cascades**

Everything else emerges from these primitives.