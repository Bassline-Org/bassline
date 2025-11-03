# Self-Describing System

The Bassline pattern system is **self-describing**: all components describe themselves as edges in the graph when they are created or installed. This means the system's structure is queryable using the same pattern language used to query user data.

## The TYPE! Convention

All types use uppercase with a `!` suffix:
- `OPERATION!` - Computational operations (ADD, MULTIPLY, etc.)
- `AGGREGATION!` - Aggregation operations (SUM, COUNT, etc.)
- `EFFECT!` - Side-effecting operations (LOG, HTTP_GET, WRITE_FILE, etc.)
- `RULE!` - User-defined rewrite rules
- `PATTERN!` - User-defined patterns
- `TOMBSTONE!` - Deleted triples
- `TYPE!` - The meta-type (all types are of type TYPE!)

### Meta-Type Closure

The type system closes the loop by making `TYPE!` itself a type:

```
TYPE! TYPE TYPE!
```

This means you can query for all types in the system:

```javascript
query [?t TYPE TYPE!]
// → [OPERATION!, AGGREGATION!, EFFECT!, RULE!, PATTERN!, TOMBSTONE!, TYPE!]
```

## How Components Self-Describe

### 1. Operations (Compute Extension)

When `installCompute(graph)` is called, each operation adds edges describing itself:

```javascript
graph.add("ADD", "TYPE", "OPERATION!");
graph.add("ADD", "DOCS", "Binary addition");

graph.add("MULTIPLY", "TYPE", "OPERATION!");
graph.add("MULTIPLY", "DOCS", "Binary multiplication");
// ... etc for all 18 operations
```

**Query all operations:**
```javascript
query [?o TYPE OPERATION!]
// → [ADD, SUBTRACT, MULTIPLY, DIVIDE, MOD, POW, SQRT, ABS, ...]
```

**Get operation documentation:**
```javascript
query [ADD DOCS ?d]
// → ["Binary addition"]
```

### 2. Aggregations (Aggregation Extension)

When `installAggregation(graph, definitions)` is called, each aggregation type adds edges:

```javascript
graph.add("SUM", "TYPE", "AGGREGATION!");
graph.add("SUM", "DOCS", "Sum of all values");

graph.add("COUNT", "TYPE", "AGGREGATION!");
graph.add("COUNT", "DOCS", "Count of items");
// ... etc
```

**Query all aggregations:**
```javascript
query [?a TYPE AGGREGATION!]
// → [SUM, COUNT, AVG, MIN, MAX]
```

### 3. Effects (Effects Extension)

When `installEffects(graph)` is called, each effect adds edges describing itself:

```javascript
// Core effects (browser-compatible)
graph.add("LOG", "TYPE", "EFFECT!");
graph.add("LOG", "CATEGORY", "io");
graph.add("LOG", "DOCS", "Log message to console");

graph.add("HTTP_GET", "TYPE", "EFFECT!");
graph.add("HTTP_GET", "CATEGORY", "http");
graph.add("HTTP_GET", "DOCS", "HTTP GET request returning JSON");
// ... etc for all core effects
```

When `installNodeEffects(graph)` is called (opt-in for Node.js), filesystem effects are added:

```javascript
graph.add("WRITE_FILE", "TYPE", "EFFECT!");
graph.add("WRITE_FILE", "CATEGORY", "filesystem");
graph.add("WRITE_FILE", "DOCS", "Write string content to file");
// ... etc
```

**Query all effects:**
```javascript
query [?e TYPE EFFECT!]
// → [LOG, ERROR, WARN, HTTP_GET, HTTP_POST, READ_FILE, WRITE_FILE, ...]
```

**Query effects by category:**
```javascript
query [?e CATEGORY "io"]
// → [LOG, ERROR, WARN]

query [?e CATEGORY "http"]
// → [HTTP_GET, HTTP_POST]

query [?e CATEGORY "filesystem"]
// → [READ_FILE, WRITE_FILE, APPEND_FILE]  (only if installNodeEffects was called)
```

**Get effect documentation:**
```javascript
query [LOG DOCS ?d]
// → ["Log message to console"]
```

**Browser Compatibility:** Core effects are automatically installed and work in both Node.js and browsers. Filesystem effects require explicit installation via `installNodeEffects(graph)` and only work in Node.js.

### 4. Rules

When a user creates a rule, it adds edges describing itself:

```javascript
rt.eval("rule ADULT [?p AGE ?a] -> [?p ADULT TRUE]");

// This adds:
// ADULT TYPE RULE!
// ADULT MATCH "[[\"?p\",\"AGE\",\"?a\"]]"
// ADULT PRODUCE "[[\"?p\",\"ADULT\",\"TRUE\"]]"
// ADULT STATUS ACTIVE
// RULE! TYPE TYPE!
```

**Query all rules:**
```javascript
query [?r TYPE RULE!]
// → [ADULT, ...]
```

**Get rule definition:**
```javascript
query [ADULT MATCH ?m]
// → ["[[\"?p\",\"AGE\",\"?a\"]]"]
```

### 5. Patterns

When a user creates a pattern, it adds edges describing itself:

```javascript
rt.eval("pattern PEOPLE [?p AGE ?a]");

// This adds:
// PEOPLE TYPE PATTERN!
// PEOPLE MATCH "[[\"?p\",\"AGE\",\"?a\"]]"
// PEOPLE STATUS ACTIVE
// PATTERN! TYPE TYPE!
```

**Query all patterns:**
```javascript
query [?p TYPE PATTERN!]
// → [PEOPLE, ...]
```

### 5. Tombstones

When a triple is deleted, a tombstone is created:

```javascript
rt.eval("delete ALICE AGE 30");

// This adds:
// TOMBSTONE-<timestamp>-<random> TYPE TOMBSTONE!
// TOMBSTONE-<timestamp>-<random> SOURCE ALICE
// TOMBSTONE-<timestamp>-<random> ATTR AGE
// TOMBSTONE-<timestamp>-<random> TARGET 30
// TOMBSTONE! TYPE TYPE!
```

**Query all tombstones:**
```javascript
query [?t TYPE TOMBSTONE!]
```

## Why Self-Description?

### Declarative, Not Imperative

Before this approach, we had imperative JavaScript watchers that:
1. Matched patterns
2. Checked if metadata already existed
3. Conditionally added edges

This was **mechanical** - JavaScript doing housekeeping rather than expressing computation.

Now, components simply add edges when created. The graph **is** the source of truth.

### Queryable Structure

Since everything describes itself as edges, you can:
- **Inspect** the system: `query [?t TYPE TYPE!]`
- **Document** operations: `query [?o DOCS ?d]`
- **Audit** what rules exist: `query [?r TYPE RULE!]`
- **Understand** the system purely through queries

### No Special Cases

There's no separate "meta" system or reflection API. Everything is edges, and edges are queryable using the same pattern language as user data.

### Incremental and Consistent

When extensions are installed or components created:
1. Edges are added describing them
2. Watchers are set up for computation
3. The self-description edges are idempotent (adding `RULE! TYPE TYPE!` multiple times is fine)

## Examples in the REPL

Start the REPL:
```bash
node examples/repl.js
```

### Explore the System

```javascript
// What types exist?
query [?t TYPE TYPE!]

// What operations are available?
query [?o TYPE OPERATION!]

// How does ADD work?
query [ADD DOCS ?d]

// Create a rule and see it appear
rule TEST [?x ?y ?z] -> [?x RESULT TRUE]
query [?r TYPE RULE!]
// → [TEST]

// What does the TEST rule match?
query [TEST MATCH ?m]
```

### Build Tools Using Self-Description

You could build a help system:

```javascript
// Get documentation for all operations
query [?op TYPE OPERATION!]
// For each op:
query [<op> DOCS ?d]
```

Or a system dashboard:

```javascript
// Count entities by type
query [?e TYPE ?t]
// Group by ?t
```

Or a debugging tool:

```javascript
// Find all active rules
query [?r STATUS ACTIVE]
query [?r TYPE RULE!]
```

## Architecture Principle

> **The system describes itself through the same primitives it computes with.**

No special meta-layer. No reflection API. No separate type system.

Just edges. All the way down.

Even `TYPE!` is an edge: `TYPE! TYPE TYPE!` 🔁
