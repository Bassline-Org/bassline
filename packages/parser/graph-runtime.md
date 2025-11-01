# Bassline Graph Runtime - Technical Documentation

## Architecture Overview

The runtime is built on a **pure triple store** where all data is represented as
`(source, attribute, target)` edges. There are no explicit "nodes" - nodes are
derived as the unique set of all sources and targets in the graph.

### Core Data Model

```javascript
// Edge structure
{
  source: string,  // Entity ID
  attr: string,    // Relationship/property name
  target: any     // Value or entity ID
}
```

**Key Design Decisions:**

1. **Implicit Nodes**: Nodes are computed on-demand from edges, preventing sync
   issues
2. **Content-based IDs for literals, unique IDs for syntax**:
   - Numbers: `value.toString()` → `"123"`
   - Strings: `hash(value)` → `"0xabc..."`
   - Words: `randomUUID()` (each instance unique)
   - Collections: `randomUUID()`
3. **Word Identity**: Each word instance in the parse tree gets a unique ID, but
   shares spelling:
   ```javascript
   (word - uuid - 1, "TYPE?", "WORD!")(word - uuid - 1, "SPELLING?", "FOO") // normalize(value)
   (word - uuid - 2, "TYPE?", "WORD!")(word - uuid - 2, "SPELLING?", "FOO"); // Same spelling, different instance
   ```
4. **Collections as Subgraphs**: Blocks/arrays stored as:
   ```
   (block-id, "0", child1-id)
   (block-id, "1", child2-id)
   (child1-id, "PARENT?", block-id)
   ```

---

## Query System

### Query Builder Architecture

The query builder uses **functional composition** - each method adds a
transformation to a query pipeline:

```javascript
const query = g.query()
    .match("?x", "TYPE?", "WORD!") // Pattern 1
    .match("?x", "SPELLING?", "FOO") // Pattern 2 - same word instance
    .select("?x") // Projection
    .map((x) => x.id) // Transform
    .reduce((sum, x) => sum + x, 0); // Aggregate
```

**Internal Structure:**

```javascript
{
  queries: [],        // Array of transformation functions
  sideEffects: [],    // Functions to run on results
  hasVariables: false // Whether any pattern uses variables
}
```

### Pattern Matching with Variables

**Variable Syntax:** Any string starting with `?` is a variable: `"?x"`,
`"?value"`, `"?ctx"`

**Matching Algorithm:**

1. **First Pattern (Initialization)**:
   ```javascript
   // Input: plain edges
   // For each edge, try to establish bindings
   for (const edge of edges) {
       const bindings = {};
       if (
           matchField("?x", edge.source, bindings) &&
           matchField("TYPE?", edge.attr, bindings) &&
           matchField("WORD!", edge.target, bindings)
       ) {
           results.push({ edge, bindings: { "?x": edge.source } });
       }
   }
   ```

2. **Subsequent Patterns (Extension)**:
   ```javascript
   // Input: {edge, bindings} pairs from previous pattern
   // For each existing binding set, search ALL edges for compatible matches
   for (const item of items) {
       for (const edge of g.edges) {
           const newBindings = { ...item.bindings };
           if (
               matchField("?x", edge.source, newBindings) && // ?x must match existing binding
               matchField("SPELLING?", edge.attr, newBindings) &&
               matchField("FOO", edge.target, newBindings)
           ) {
               results.push({ edge, bindings: newBindings });
           }
       }
   }
   ```

**Example - Finding specific word instances:**

```javascript
// Find all word instances with spelling "PRINT"
g.query()
    .match("?word", "TYPE?", "WORD!")
    .match("?word", "SPELLING?", "PRINT")
    .select("?word")
    .run();
// Returns: [{word: "uuid-1"}, {word: "uuid-2"}, ...]
// Each UUID is a different occurrence of "print" in the source
```

**Variable Binding Logic (`matchField`):**

```javascript
function matchField(patternField, edgeField, bindings) {
    // Wildcard
    if (patternField === null || patternField === "*") return true;

    // Variable
    if (typeof patternField === "string" && patternField.startsWith("?")) {
        if (patternField in bindings) {
            // Variable already bound - check consistency
            return bindings[patternField] === edgeField;
        } else {
            // New variable - bind it
            bindings[patternField] = edgeField;
            return true;
        }
    }

    // Literal or array
    if (Array.isArray(patternField)) {
        return patternField.includes(edgeField);
    }

    return patternField === edgeField;
}
```

### Query Pipeline Execution

**Phase 1: Pattern Matching**

- Each `match()` adds a filter/join operation to `queries[]`
- Patterns with variables perform joins via shared variable bindings
- Non-variable patterns use simple filtering

**Phase 2: Transformations**

- `map()`, `select()`, `reduce()` transform the result stream
- Transformations preserve bindings until extraction

**Phase 3: Side Effects**

- `addSideEffect()` registers callbacks
- Side effects only run if results.length > 0
- Used for constraints and reactive rules

**Phase 4: Result Extraction**

```javascript
compute(edges) {
  let results = edges;
  
  // Run all transformations
  for (const query of builder.queries) {
    results = query(results);
  }
  
  // Run side effects
  if (results.length > 0) {
    for (const effect of builder.sideEffects) {
      effect(results);
    }
  }
  
  // Extract final values
  if (hasVariables && results[0].edge) {
    results = results.map(r => r.edge);  // Return edges
  }
  
  return [results, shouldCache];
}
```

---

## Materialized Views

Materialized views are **incremental query results** that update only when new
relevant edges are added.

### Architecture

```javascript
materialize() {
  let partialResults = [];  // Edges that partially matched
  let results = [];         // Complete matches
  let lastHeight = 0;       // Position in global edge array
  
  return () => {
    const unseen = g.edges.slice(lastHeight, g.edges.length);
    const toProcess = partialResults.concat(unseen);
    const [newResults, shouldCache] = builder.compute(toProcess);
    
    // Three cases:
    // 1. No match at all → discard edges (garbage collection)
    // 2. Partial match → cache for next time (might complete later)
    // 3. Complete match → add to results, clear cache
  }
}
```

### Incremental Maintenance

**Why `partialResults`?**

For multi-pattern queries with joins, edges might arrive out of order:

```javascript
// Query: find word instances with SPELLING=FOO and VALUE=123

// Time 1: Edge arrives (word-id1, SPELLING?, FOO)
// First pattern matches, but second doesn't
// → Store in partialResults

// Time 2: Edge arrives (word-id1, VALUE?, 123)
// Now BOTH patterns match!
// → Emit result, clear partialResults
```

**Garbage Collection:**

If an edge matches NO patterns, discard it immediately:

```javascript
const [newResults, shouldCache] = compute(toProcess);

if (!shouldCache) {
    // First pattern didn't match - these edges are irrelevant
    return results; // Don't cache, just return existing results
}
```

### Rollback Detection

```javascript
if (lastHeight > g.edges.length) {
    // Graph was rolled back (transaction failed)
    // Recompute everything from scratch
    lastHeight = g.edges.length;
    const [newResults] = builder.compute(g.edges);
    partialResults = [];
    return newResults;
}
```

---

## Transactions

Transactions provide **atomicity** - all changes commit or none do.

### Transaction Structure

```javascript
tx() {
  let committed = false;
  return {
    changes: [],
    relate(source, attr, target) {
      this.changes.push({source, attr, target});
      return this;
    },
    commit() {
      if (!committed) {
        const oldEdges = [...g.edges];
        
        // Apply changes
        for (const change of this.changes) {
          g.relate(change.source, change.attr, change.target);
        }
        
        // Validate constraints
        const valid = g.runConstraints();
        
        if (!valid) {
          // Rollback
          g.edges = oldEdges;
          return false;
        }
        
        // Fire triggers
        g.runTriggers();
        committed = true;
        return true;
      }
    }
  };
}
```

### Constraint Validation

Constraints are **materialized queries that throw on match**:

```javascript
g.constraint((builder) => {
    return builder
        .match("BAR", "PARENT?", "BLOCK!")
        .addSideEffect(() => {
            throw new Error("BAR cannot have BLOCK! as parent");
        });
});
```

**Execution Order:**

1. Transaction applies changes to graph
2. All constraint queries run (via `materialize()`)
3. If any throws → rollback to `oldEdges`
4. If all pass → commit and run triggers

---

## Reactive Updates

### Trigger System

```javascript
enableReactivity() {
  builder.removeTrigger = g.addTrigger(() =>
    builder.compute(g.edges)
  );
}
```

Triggers fire **after successful transaction commit**, allowing rules to react
to graph changes.

### Rule Stratification (Future)

Currently all triggers run in registration order. For semantic rules, you'll
want:

1. **Semantic rules** (syntax → state)
2. **Derived facts** (inference rules)
3. **Views** (indexes, aggregations)

Implemented via priority levels or explicit phases.

---

## Key Algorithms

### Join Algorithm (Nested Loop with Variable Binding)

```
For first pattern:
  For each edge in edges:
    If edge matches pattern:
      Create bindings {?var: value}
      Emit {edge, bindings}

For subsequent patterns:
  For each {edge, bindings} from previous:
    For each edge in ALL edges:
      Try to extend bindings
      If successful:
        Emit {edge, newBindings}
```

**Time Complexity:**

- First pattern: O(E) where E = number of edges
- Each additional pattern: O(R × E) where R = results from previous pattern
- Total for N patterns: O(E^N) worst case

**Optimizations (not yet implemented):**

- Index edges by attribute: O(1) lookup instead of O(E) scan
- Join ordering: smallest result set first
- Compiled query plans

### Incremental View Maintenance

**Algorithm:**

```
On each call:
  1. Compute delta = new edges since last call
  2. Combine with pending edges: toProcess = pending + delta
  3. Run query on toProcess
  4. If no matches on first pattern:
       Discard (garbage collection)
  5. Else if no complete matches:
       Cache in pending (partial match)
  6. Else:
       Accumulate results, clear pending
```

**Correctness:** Queries see all edges eventually, allowing out-of-order
arrival.

**Efficiency:** Only process new edges, not entire graph each time.

---

## Design Patterns

### Pattern: Reactive Constraint

```javascript
g.constraint((builder) => {
    return builder
        .match("?word", "SPELLING?", "FOO")
        .match("?word", "SEMANTICS?", "NORMAL")
        .addSideEffect((results) => {
            const tx = g.tx();
            for (const { bindings } of results) {
                tx.relate(bindings["?word"], "VALUE?", 69);
            }
            tx.commit();
        });
});
```

When any word instance with spelling FOO gets `SEMANTICS?=NORMAL`, automatically
set its value.

### Pattern: Index Maintenance

```javascript
const blockIndex = g.query()
    .match("?id", "TYPE?", "BLOCK!")
    .materialize();

// Always up-to-date
console.log(blockIndex().length);
```

### Pattern: Multi-way Join

```javascript
// Find all setword assignments: (setword-instance, spelling, value)
g.query()
    .match("?block", "0", "?setword")
    .match("?setword", "TYPE?", "SETWORD!")
    .match("?setword", "SPELLING?", "?name")
    .match("?block", "1", "?value")
    .select("?setword", "?name", "?value")
    .run();
```

---

## Performance Characteristics

**Space Complexity:**

- Graph: O(E) where E = number of edges
- Materialized view: O(R) where R = result size
- Transaction: O(C) where C = number of changes

**Time Complexity:**

| Operation        | Cold            | Hot (indexed)       |
| ---------------- | --------------- | ------------------- |
| Insert edge      | O(1)            | O(1)                |
| Pattern match    | O(E)            | O(log E) with index |
| N-way join       | O(E^N)          | O(R₁ × R₂ × ...)    |
| Materialize      | O(E) first call | O(Δ) incremental    |
| Constraint check | O(C × E)        | O(C × R) indexed    |

**Bottlenecks:**

1. Linear scan for pattern matching (needs indexes)
2. Nested loop joins (needs join ordering)
3. Constraint checks run on all edges (needs selective indexing)

---

## Future Optimizations

### 1. Indexes

```javascript
// Index by attribute
g.addIndex("attr", ["TYPE?", "SPELLING?", "VALUE?"]);

// Now O(log E) instead of O(E)
g.query().match("?x", "TYPE?", "WORD!").run();
```

### 2. Query Compilation

```javascript
// Instead of interpreting patterns each time:
const compiled = g.query()
    .match("?x", "TYPE?", "WORD!")
    .compile(); // Generates optimized code

compiled.run(); // Much faster
```

### 3. Join Ordering

```javascript
// Analyze statistics to reorder joins:
// Small result sets first, selective patterns early
```

### 4. Datalog-style Recursion

```javascript
// Transitive closure
g.rule()
    .match("?x", "PARENT", "?y")
    .emit("?x", "ANCESTOR", "?y")
    .match("?x", "ANCESTOR", "?z")
    .match("?z", "PARENT", "?y")
    .emit("?x", "ANCESTOR", "?y");
```

---

## API Summary

### Graph

- `g.relate(source, attr, target)` - Add edge
- `g.query()` - Create query builder
- `g.tx()` - Start transaction
- `g.constraint(fn)` - Add constraint
- `g.addTrigger(fn)` - Add trigger
- `g.nodes` - Get all node IDs

### Query Builder

- `.match(source, attr, target)` - Add pattern (supports `?vars`, `*`, arrays)
- `.select(...vars)` - Project to specific variables
- `.map(fn)` - Transform results
- `.reduce(fn, initial)` - Aggregate
- `.addSideEffect(fn)` - Run callback on results
- `.run()` - Execute and return results
- `.materialize()` - Create incremental view
- `.enableReactivity()` - React to graph changes

### Transaction

- `tx.relate(source, attr, target)` - Stage change
- `tx.commit()` - Apply changes atomically

---

## Word Identity and Spelling

**Important:** Words in Bassline have two aspects:

1. **Instance Identity**: Each occurrence in the source gets a unique ID
2. **Spelling**: The normalized name, shared across instances

```javascript
// Source: foo: 123
// Creates:
(setword - uuid, "TYPE?", "SETWORD!")(setword - uuid, "SPELLING?", "FOO")(
    number - uuid,
    "TYPE?",
    "NUMBER!",
)(number - uuid, "VALUE?", 123) // Another occurrence: print foo
(word - uuid - 1, "TYPE?", "WORD!")(word - uuid - 1, "SPELLING?", "PRINT")(
    word - uuid - 2,
    "TYPE?",
    "WORD!",
)(word - uuid - 2, "SPELLING?", "FOO");

// Both FOO instances have different UUIDs but same spelling
```

**Query Patterns:**

```javascript
// Find all instances of a specific spelling
g.query()
    .match("?word", "SPELLING?", "FOO")
    .run();

// Find specific word types with spelling
g.query()
    .match("?word", "TYPE?", "WORD!")
    .match("?word", "SPELLING?", "PRINT")
    .run();

// Bind variable in context
g.query()
    .match("?ctx", "?spelling", "?value") // ?spelling is the normalized name
    .match("?word", "SPELLING?", "?spelling") // Same spelling, links word to binding
    .select("?word", "?value")
    .run();
```

---

This architecture provides a foundation for implementing semantic rules as graph
rewrites, where evaluation becomes pattern matching + insertions that trigger
more rules.
